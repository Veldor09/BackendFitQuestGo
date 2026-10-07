import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { distanciaMetros } from '../../common/distancia.util';
import { esViolacionDeUnicidad } from '../../common/postgres';
import { RADIO_VOTO_METROS } from '../../common/votacion';
import { esAdmin } from '../Auth/es-admin';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { InsigniasService } from '../Insignias/insignias.service';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import type { User } from '../Usuarios/user.entity';
import { CategoriaNodo } from './categoria-nodo.enum';
import { CrearNodoDto, VotarNodoDto } from './dto/NodoDTO';
import { EstadoNodo, TipoVotoNodo, UMBRAL_OBSOLETO } from './estado-nodo.enum';
import { detectarTipoImagen, MAX_FOTO_BYTES, TipoImagen } from './imagen.util';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { Nodo } from './nodo.entity';

/**
 * Un punto con su recuento de votos y el voto de quien lo consulta (o null).
 * De quien lo propuso solo viaja el nombre: cualquiera que mire el mapa recibe
 * esto, asi que no lleva su correo.
 */
export type NodoConVotos = Omit<Nodo, 'creadoPor'> & {
  creadoPor: Pick<User, 'id' | 'nombreUser'>;
  miVoto: TipoVotoNodo | null;
  confirmaciones: number;
  obsoletos: number;
};

const contar = (votos: NodoVoto[], tipo: TipoVotoNodo): number =>
  votos.filter((v) => v.tipo === tipo).length;

/** Suma al punto el recuento de `votos` (los de ese punto) y el voto de `usuarioId`. */
const conVotos = (
  nodo: Nodo,
  votos: NodoVoto[],
  usuarioId: number,
): NodoConVotos => ({
  ...nodo,
  creadoPor: { id: nodo.creadoPor.id, nombreUser: nodo.creadoPor.nombreUser },
  confirmaciones: contar(votos, TipoVotoNodo.Confirmar),
  obsoletos: contar(votos, TipoVotoNodo.Obsoleto),
  miVoto: votos.find((v) => v.usuarioId === usuarioId)?.tipo ?? null,
});

@Injectable()
export class NodoService {
  private readonly logger = new Logger(NodoService.name);

  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,
    @InjectRepository(NodoFoto)
    private readonly fotoRepository: Repository<NodoFoto>,
    @InjectRepository(NodoVoto)
    private readonly votoRepository: Repository<NodoVoto>,
    private readonly insigniasService: InsigniasService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Nodos visibles en el mapa: solo los aprobados. `creadoPor` es eager y
   * `select` no recorta columnas de relaciones eager de forma confiable, asi
   * que se arma con QueryBuilder para no exponer el correo de quien lo
   * propuso a cualquiera que mire el mapa. Cada uno trae el recuento de votos
   * y `miVoto`, para que la app no le vuelva a pedir el voto a quien ya votó.
   */
  async findAprobados(usuarioId: number): Promise<NodoConVotos[]> {
    const nodos = await this.nodoRepository
      .createQueryBuilder('nodo')
      .leftJoin('nodo.creadoPor', 'creadoPor')
      .addSelect(['creadoPor.id', 'creadoPor.nombreUser'])
      .where('nodo.estado = :estado', { estado: EstadoNodo.Aprobado })
      .orderBy('nodo.id', 'DESC')
      .getMany();
    if (nodos.length === 0) {
      return [];
    }
    const votos = await this.votoRepository.find({
      where: { nodoId: In(nodos.map((n) => n.id)) },
    });
    return nodos.map((n) =>
      conVotos(
        n,
        votos.filter((v) => v.nodoId === n.id),
        usuarioId,
      ),
    );
  }

  /** Cola de moderacion (ADM-07). */
  findPendientes(): Promise<Nodo[]> {
    return this.nodoRepository.find({
      where: { estado: EstadoNodo.Pendiente },
      order: { id: 'ASC' },
    });
  }

  findMisNodos(usuarioId: number): Promise<Nodo[]> {
    return this.nodoRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Nodo> {
    const nodo = await this.nodoRepository.findOne({ where: { id } });
    if (!nodo) {
      throw new NotFoundException(`Nodo ${id} no encontrado`);
    }
    return nodo;
  }

  async create(dto: CrearNodoDto, usuarioId: number): Promise<Nodo> {
    const nodo = this.nodoRepository.create({
      ...dto,
      // El texto libre solo tiene sentido con la categoria "otro".
      categoriaOtro:
        dto.categoria === CategoriaNodo.Otro
          ? (dto.categoriaOtro ?? null)
          : null,
      estado: EstadoNodo.Pendiente,
      creadoPor: { id: usuarioId },
    });
    const guardado = await this.nodoRepository.save(nodo);

    // Notificar al usuario sobre el envío a revisión del punto de interés
    try {
      await this.notificacionesService.crear({
        idUsuario: usuarioId,
        categoria: CategoriaNotificacion.Eventos,
        titulo: 'Punto de interés enviado a revisión',
        mensaje: `Tu propuesta de punto de interés "${guardado.nombre}" fue enviada al equipo de moderación.`,
        referenciaTipo: ReferenciaTipoNotificacion.Nodo,
        referenciaId: guardado.id,
      });
    } catch (error) {
      this.logger.error(
        `Error al notificar creación de nodo para usuario ${usuarioId}: ${error.message}`,
      );
    }

    // Evaluar insignia PRIMER_PUNTO_INTERES
    try {
      await this.insigniasService.evaluar(usuarioId);
    } catch (error) {
      this.logger.error(
        `Error al evaluar insignias tras crear nodo para usuario ${usuarioId}: ${error.message}`,
      );
    }

    return guardado;
  }

  async cambiarEstado(id: number, estado: EstadoNodo): Promise<Nodo> {
    const nodo = await this.nodoRepository.findOne({
      where: { id },
      relations: ['creadoPor'],
    });
    if (!nodo) {
      throw new NotFoundException(`Nodo ${id} no encontrado`);
    }
    const estadoAnterior = nodo.estado;
    nodo.estado = estado;
    const actualizado = await this.nodoRepository.save(nodo);

    const autorId = nodo.creadoPor?.id;
    if (estadoAnterior !== estado && autorId) {
      try {
        if (estado === EstadoNodo.Aprobado) {
          await this.notificacionesService.crear({
            idUsuario: autorId,
            categoria: CategoriaNotificacion.Eventos,
            titulo: `¡Tu punto de interés "${nodo.nombre}" fue aprobado!`,
            mensaje:
              'La moderación validó tu propuesta. El punto de interés ya es visible en el mapa.',
            referenciaTipo: ReferenciaTipoNotificacion.Nodo,
            referenciaId: nodo.id,
          });
        } else if (estado === EstadoNodo.Rechazado) {
          await this.notificacionesService.crear({
            idUsuario: autorId,
            categoria: CategoriaNotificacion.Eventos,
            titulo: `Tu punto de interés "${nodo.nombre}" no fue aprobado`,
            mensaje:
              'La propuesta no cumple con los criterios de moderación comunitarios.',
            referenciaTipo: ReferenciaTipoNotificacion.Nodo,
            referenciaId: nodo.id,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error al notificar cambio de estado de nodo ${id}: ${error.message}`,
        );
      }
    }

    return actualizado;
  }

  /** NOD-04 "Sigue ahi": quien pasa por el punto confirma que existe. */
  confirmar(
    id: number,
    usuarioId: number,
    posicion: VotarNodoDto,
  ): Promise<NodoConVotos> {
    return this.votar(id, usuarioId, TipoVotoNodo.Confirmar, posicion);
  }

  /**
   * NOD-04 "Ya no existe": suma un voto de obsoleto; al llegar al umbral (y
   * superar a las confirmaciones) el punto sale del mapa sin intervencion de un
   * admin.
   */
  marcarObsoleto(
    id: number,
    usuarioId: number,
    posicion: VotarNodoDto,
  ): Promise<NodoConVotos> {
    return this.votar(id, usuarioId, TipoVotoNodo.Obsoleto, posicion);
  }

  /**
   * Un voto vale solo sobre un punto que esta en el mapa, si no lo propusiste
   * vos, si estas a `RADIO_VOTO_METROS` o menos de el y si es tu primer voto.
   */
  private async votar(
    id: number,
    usuarioId: number,
    tipo: TipoVotoNodo,
    posicion: VotarNodoDto,
  ): Promise<NodoConVotos> {
    const nodo = await this.findOne(id);
    if (nodo.estado !== EstadoNodo.Aprobado) {
      throw new ConflictException('El punto ya no esta en el mapa');
    }
    if (nodo.creadoPor.id === usuarioId) {
      throw new ForbiddenException(
        'No podes votar un punto que propusiste vos',
      );
    }

    const distancia = distanciaMetros(
      posicion.lat,
      posicion.lng,
      nodo.lat,
      nodo.lng,
    );
    if (distancia > RADIO_VOTO_METROS) {
      throw new BadRequestException(
        `Estas a ${Math.round(distancia)} m del punto: acercate a menos de ${RADIO_VOTO_METROS} m para votar`,
      );
    }

    await this.registrarVoto(nodo.id, usuarioId, tipo);

    const votos = await this.votoRepository.find({
      where: { nodoId: nodo.id },
    });
    const confirmaciones = contar(votos, TipoVotoNodo.Confirmar);
    const obsoletos = contar(votos, TipoVotoNodo.Obsoleto);
    if (obsoletos >= UMBRAL_OBSOLETO && obsoletos > confirmaciones) {
      nodo.estado = EstadoNodo.Obsoleto;
      await this.nodoRepository.save(nodo);
    }
    return conVotos(nodo, votos, usuarioId);
  }

  private async registrarVoto(
    nodoId: number,
    usuarioId: number,
    tipo: TipoVotoNodo,
  ): Promise<void> {
    try {
      await this.votoRepository.save(
        this.votoRepository.create({ nodoId, usuarioId, tipo }),
      );
    } catch (error) {
      // "Un voto por persona" lo impone la restriccion unica de la tabla, no un
      // chequeo previo: asi tambien se frena el doble toque.
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya votaste este punto');
      }
      throw error;
    }
  }

  /**
   * Adjunta (o reemplaza) la foto de un nodo. Solo su dueño o un admin. Se
   * confia en los bytes, no en lo que declare el archivo: solo JPEG, PNG o WebP.
   */
  async guardarFoto(
    id: number,
    datos: Buffer,
    actual: UsuarioAutenticado,
  ): Promise<Nodo> {
    const nodo = await this.findOne(id);
    if (nodo.creadoPor.id !== actual.id && !esAdmin(actual)) {
      throw new ForbiddenException('Este punto no te pertenece');
    }
    if (datos.length > MAX_FOTO_BYTES) {
      throw new PayloadTooLargeException(
        `La foto pesa mas de ${MAX_FOTO_BYTES / (1024 * 1024)} MB`,
      );
    }
    const tipoMime: TipoImagen | null = detectarTipoImagen(datos);
    if (!tipoMime) {
      throw new BadRequestException('La foto debe ser JPEG, PNG o WebP');
    }
    await this.fotoRepository.save({ nodoId: id, contenido: datos, tipoMime });
    nodo.conFoto = true;
    return this.nodoRepository.save(nodo);
  }

  /**
   * Foto de un nodo. Un punto aprobado lo ve cualquier usuario; uno pendiente
   * o rechazado solo su dueño y el admin (que lo necesita para moderar). Si no
   * le toca verla responde 404, igual que si no existiera.
   */
  async obtenerFoto(
    id: number,
    actual: UsuarioAutenticado,
  ): Promise<{ contenido: Buffer; tipoMime: string }> {
    const nodo = await this.findOne(id);
    const puedeVer =
      nodo.estado === EstadoNodo.Aprobado ||
      nodo.creadoPor.id === actual.id ||
      esAdmin(actual);
    const foto = puedeVer
      ? await this.fotoRepository.findOne({ where: { nodoId: id } })
      : null;
    if (!foto) {
      throw new NotFoundException(`El nodo ${id} no tiene foto`);
    }
    return { contenido: foto.contenido, tipoMime: foto.tipoMime };
  }
}
