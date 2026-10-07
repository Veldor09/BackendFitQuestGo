import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { esAdmin } from '../Auth/es-admin';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { InsigniasService } from '../Insignias/insignias.service';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CrearRutaDto } from './dto/RutaDTO';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';

@Injectable()
export class RutaService {
  private readonly logger = new Logger(RutaService.name);

  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
    @InjectRepository(RutaFavorita)
    private readonly favoritaRepository: Repository<RutaFavorita>,
    private readonly insigniasService: InsigniasService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Explorar rutas comunitarias (RTE-01).
   */
  findPublicadas(): Promise<Ruta[]> {
    return this.rutaRepository
      .createQueryBuilder('ruta')
      .leftJoin('ruta.creadoPor', 'creadoPor')
      .addSelect(['creadoPor.id', 'creadoPor.nombreUser'])
      .where('ruta.estado = :estado', { estado: EstadoRuta.Publicada })
      .orderBy('ruta.id', 'DESC')
      .getMany();
  }

  /** Mis rutas, todos los estados (RTE-02). */
  findMisRutas(usuarioId: number): Promise<Ruta[]> {
    return this.rutaRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { id: 'DESC' },
    });
  }

  /** Rutas guardadas / favoritas del usuario (RTE-03). */
  async findFavoritas(usuarioId: number): Promise<Ruta[]> {
    const favs = await this.favoritaRepository.find({
      where: { usuarioId },
      order: { guardadoEn: 'DESC' },
    });

    if (favs.length === 0) {
      return [];
    }

    const ids = favs.map((f) => f.rutaId);
    return this.rutaRepository.find({
      where: { id: In(ids) },
    });
  }

  /** Lista de IDs de rutas favoritas para marcar en UI. */
  async findFavoritasIds(usuarioId: number): Promise<number[]> {
    const favs = await this.favoritaRepository.find({
      where: { usuarioId },
      select: ['rutaId'],
    });
    return favs.map((f) => f.rutaId);
  }

  /** Toggle favorita: si existe la elimina, si no existe la agrega. */
  async toggleFavorita(
    rutaId: number,
    usuarioId: number,
  ): Promise<{ favorita: boolean }> {
    const ruta = await this.rutaRepository.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException(`Ruta ${rutaId} no encontrada`);
    }

    const existente = await this.favoritaRepository.findOne({
      where: { usuarioId, rutaId },
    });

    if (existente) {
      await this.favoritaRepository.remove(existente);
      return { favorita: false };
    }

    const fav = this.favoritaRepository.create({
      usuarioId,
      rutaId,
    });
    await this.favoritaRepository.save(fav);
    return { favorita: true };
  }

  /** Cola de moderacion (ADM-04). */
  findPendientes(): Promise<Ruta[]> {
    return this.rutaRepository.find({
      where: { estado: EstadoRuta.Pendiente },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Ruta> {
    const ruta = await this.rutaRepository.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    return ruta;
  }

  /**
   * Una ruta por su id. Una publicada la ve cualquiera; una privada, pendiente
   * o rechazada solo quien la creo y el admin (que la revisa): su trazo puede
   * mostrar de donde sale y adonde llega alguien. Para el resto responde 404,
   * igual que si no existiera.
   */
  async verRuta(id: number, actual: UsuarioAutenticado): Promise<Ruta> {
    const ruta = await this.findOne(id);
    const puedeVer =
      ruta.estado === EstadoRuta.Publicada ||
      ruta.creadoPor.id === actual.id ||
      esAdmin(actual);
    if (!puedeVer) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    return ruta;
  }

  async create(dto: CrearRutaDto, usuarioId: number): Promise<Ruta> {
    const visibilidad = dto.visibilidad || 'privada';
    const estado = (visibilidad === 'publica' || visibilidad === 'publico')
      ? EstadoRuta.Pendiente
      : EstadoRuta.Privada;
    const ruta = this.rutaRepository.create({
      ...dto,
      visibilidad,
      estado,
      creadoPor: { id: usuarioId },
    });
    const guardada = await this.rutaRepository.save(ruta);

    // Notificar al usuario sobre la creación de la ruta
    try {
      if (estado === EstadoRuta.Pendiente) {
        await this.notificacionesService.crear({
          idUsuario: usuarioId,
          categoria: CategoriaNotificacion.Rutas,
          titulo: 'Ruta enviada a revisión',
          mensaje: `Tu ruta pública "${guardada.nombre}" fue enviada al equipo de moderación.`,
          referenciaTipo: ReferenciaTipoNotificacion.Ruta,
          referenciaId: guardada.id,
        });
      } else {
        await this.notificacionesService.crear({
          idUsuario: usuarioId,
          categoria: CategoriaNotificacion.Rutas,
          titulo: 'Ruta creada con éxito',
          mensaje: `Tu ruta "${guardada.nombre}" ha sido guardada en tus rutas.`,
          referenciaTipo: ReferenciaTipoNotificacion.Ruta,
          referenciaId: guardada.id,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error al notificar creación de ruta para usuario ${usuarioId}: ${error.message}`,
      );
    }

    // Evaluar insignias en segundo plano seguro (PRIMERA_RUTA, KM_10, KM_50, KM_100)
    try {
      await this.insigniasService.evaluar(usuarioId);
    } catch (error) {
      this.logger.error(
        `Error al evaluar insignias tras crear ruta para usuario ${usuarioId}: ${error.message}`,
      );
    }

    return guardada;
  }

  /** Envia una ruta privada a revision (RTE-07/MOD-01). Solo el dueno. */
  async solicitarPublicacion(id: number, usuarioId: number): Promise<Ruta> {
    const ruta = await this.findOne(id);
    if (ruta.creadoPor.id !== usuarioId) {
      throw new ForbiddenException('Esta ruta no te pertenece');
    }
    if (ruta.estado !== EstadoRuta.Privada) {
      throw new ForbiddenException(
        'Solo una ruta privada puede enviarse a revision',
      );
    }
    ruta.estado = EstadoRuta.Pendiente;
    const actualizada = await this.rutaRepository.save(ruta);

    try {
      await this.notificacionesService.crear({
        idUsuario: usuarioId,
        categoria: CategoriaNotificacion.Rutas,
        titulo: 'Ruta enviada a revisión',
        mensaje: `Tu solicitud para publicar "${ruta.nombre}" fue enviada al equipo de moderación.`,
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: ruta.id,
      });
    } catch (error) {
      this.logger.error(
        `Error al notificar solicitud de publicación de ruta ${id}: ${error.message}`,
      );
    }

    return actualizada;
  }

  /** Aprobar / rechazar (ADM-05): solo admin. */
  async cambiarEstado(id: number, estado: EstadoRuta): Promise<Ruta> {
    const ruta = await this.rutaRepository.findOne({
      where: { id },
      relations: ['creadoPor'],
    });
    if (!ruta) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    const estadoAnterior = ruta.estado;
    ruta.estado = estado;
    const actualizada = await this.rutaRepository.save(ruta);

    const autorId = ruta.creadoPor?.id;
    if (estadoAnterior !== estado && autorId) {
      try {
        if (estado === EstadoRuta.Publicada) {
          await this.notificacionesService.crear({
            idUsuario: autorId,
            categoria: CategoriaNotificacion.Rutas,
            titulo: `¡Tu ruta "${ruta.nombre}" fue aprobada!`,
            mensaje:
              'La moderación verificó el trazado. Tu ruta ya es pública y visible para la comunidad.',
            referenciaTipo: ReferenciaTipoNotificacion.Ruta,
            referenciaId: ruta.id,
          });
        } else if (estado === EstadoRuta.Rechazada) {
          await this.notificacionesService.crear({
            idUsuario: autorId,
            categoria: CategoriaNotificacion.Rutas,
            titulo: `Tu ruta "${ruta.nombre}" no fue aprobada`,
            mensaje: 'La ruta no cumple con los criterios de publicación comunitarios.',
            referenciaTipo: ReferenciaTipoNotificacion.Ruta,
            referenciaId: ruta.id,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error al notificar cambio de estado de ruta ${id}: ${error.message}`,
        );
      }
    }

    return actualizada;
  }
}

