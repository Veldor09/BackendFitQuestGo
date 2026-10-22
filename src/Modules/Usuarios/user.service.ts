import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';

import { ContrasenasServicio } from '../Auth/services/contrasenas.service';
import { InsigniasService } from '../Insignias/insignias.service';
import { ActualizarPerfilEmpresaDto } from '../Auth/dto/actualizar-perfil-empresa.dto';

import {
  detectarTipoImagen,
  MAX_FOTO_BYTES,
} from '../Nodos/imagen.util';

import { Ruta } from '../Rutas/ruta.entity';
import { RutaFavorita } from '../Rutas/ruta-favorita.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { NodoVoto } from '../Nodos/nodo-voto.entity';
import { Alerta } from '../Alertas/alerta.entity';
import { AlertaVoto } from '../Alertas/alerta-voto.entity';

import { CreateUserDto, UpdateUserDto } from './dto/UserDTO';
import { EstadoUsuario } from './estado.enum';
import { Role } from './roles.entity';
import { RoleId } from './roles.enum';
import { User } from './user.entity';
import { UsuarioFoto } from './usuario-foto.entity';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    private readonly contrasenas: ContrasenasServicio,

    private readonly insigniasService: InsigniasService,

    @InjectRepository(UsuarioFoto)
    private readonly fotoRepository: Repository<UsuarioFoto>,

    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,

    @InjectRepository(RutaFavorita)
    private readonly rutaFavoritaRepository: Repository<RutaFavorita>,

    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,

    @InjectRepository(NodoVoto)
    private readonly nodoVotoRepository: Repository<NodoVoto>,

    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,

    @InjectRepository(AlertaVoto)
    private readonly alertaVotoRepository: Repository<AlertaVoto>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findOneUser(
    id: number,
    manager?: EntityManager,
  ): Promise<User> {
    const repository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const user = await repository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(
        `Usuario ${id} no encontrado`,
      );
    }

    return user;
  }

  async createUser(
    dto: CreateUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    const repository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const user = repository.create(dto);

    // La contraseña llega en texto plano y se almacena hasheada.
    user.passwordUserHash =
      await this.contrasenas.hashear(dto.passwordUserHash);

    user.rol = await this.getRole(dto.idrol, manager);

    return this.save(user, manager);
  }

  async updateUser(
    id: number,
    dto: UpdateUserDto,
    manager?: EntityManager,
  ): Promise<User> {
    const repository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const user = await this.findOneUser(id, manager);

    const { passwordUserHash, ...resto } = dto;

    repository.merge(user, resto);

    if (
      passwordUserHash !== undefined &&
      passwordUserHash !== ''
    ) {
      user.passwordUserHash =
        await this.contrasenas.hashear(passwordUserHash);
    }

    if (dto.idrol !== undefined) {
      user.rol = await this.getRole(dto.idrol, manager);
    }

    return this.save(user, manager);
  }

  /**
   * Permite a una cuenta Empresa actualizar
   * su nombre comercial y teléfono.
   */
  async actualizarPerfilEmpresa(
    id: number,
    dto: ActualizarPerfilEmpresaDto,
  ): Promise<User> {
    const user = await this.findOneUser(id);

    if (user.idrol !== Number(RoleId.Empresa)) {
      throw new ForbiddenException(
        'Solo una cuenta de empresa puede hacer esto',
      );
    }

    if (dto.nombreComercial !== undefined) {
      user.nombreUser = dto.nombreComercial.trim();
    }

    if (dto.telefono !== undefined) {
      user.telefono = dto.telefono.trim() || null;
    }

    return this.save(user);
  }

  /**
   * Guarda o reemplaza la fotografía de perfil.
   * Formatos permitidos: JPEG, PNG y WebP.
   * Tamaño máximo: 3 MB.
   */
  async guardarFoto(
    id: number,
    datos: Buffer,
  ): Promise<void> {
    await this.findOneUser(id);

    if (datos.length > MAX_FOTO_BYTES) {
      throw new PayloadTooLargeException(
        `La foto pesa mas de ${
          MAX_FOTO_BYTES / (1024 * 1024)
        } MB`,
      );
    }

    const tipoMime = detectarTipoImagen(datos);

    if (!tipoMime) {
      throw new BadRequestException(
        'La foto debe ser JPEG, PNG o WebP',
      );
    }

    await this.fotoRepository.save({
      usuarioId: id,
      contenido: datos,
      tipoMime,
    });
  }

  async obtenerFoto(
    id: number,
  ): Promise<{
    contenido: Buffer;
    tipoMime: string;
  }> {
    const foto = await this.fotoRepository.findOne({
      where: { usuarioId: id },
    });

    if (!foto) {
      throw new NotFoundException(
        'La cuenta no tiene foto de perfil',
      );
    }

    return {
      contenido: foto.contenido,
      tipoMime: foto.tipoMime,
    };
  }

  async quitarFoto(id: number): Promise<void> {
    await this.fotoRepository.delete({
      usuarioId: id,
    });
  }

  /**
   * Activa o desactiva una cuenta sin eliminarla.
   */
  async cambiarEstado(
    id: number,
    estado: EstadoUsuario,
    manager?: EntityManager,
  ): Promise<User> {
    const user = await this.findOneUser(id, manager);

    user.estado = estado;

    const repository = manager
      ? manager.getRepository(User)
      : this.userRepository;

    return repository.save(user);
  }

  private async getRole(
    idrol: number,
    manager?: EntityManager,
  ): Promise<Role> {
    const repository = manager
      ? manager.getRepository(Role)
      : this.roleRepository;

    const rol = await repository.findOneBy({
      idrol,
    });

    if (!rol) {
      throw new NotFoundException(
        `Rol ${idrol} no encontrado`,
      );
    }

    return rol;
  }

  private async save(
    user: User,
    manager?: EntityManager,
  ): Promise<User> {
    try {
      const repository = manager
        ? manager.getRepository(User)
        : this.userRepository;

      return await repository.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (
          error as QueryFailedError & {
            code?: string;
          }
        ).code;

        if (code === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            `El email ${user.emailUser} ya esta registrado`,
          );
        }

        if (code === PG_FOREIGN_KEY_VIOLATION) {
          throw new NotFoundException(
            `Rol ${user.idrol} no encontrado`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Estadísticas del usuario autenticado.
   * PRF-01 / BDG-01 / NAV-07.
   */
  async estadisticas(
    id: number,
  ): Promise<{
    kmRecorridos: number;
    rutasCompletadas: number;
    insignias: number;
  }> {
    await this.findOneUser(id);

    const result: any[] =
      await this.userRepository.manager.query(
        `
        SELECT
          COALESCE((SELECT SUM(CAST(distancia_km AS float)) FROM recorridos_rutas WHERE usuario_id = $1), 0) +
          COALESCE((SELECT SUM(CAST(distancia_km AS float)) FROM rutas WHERE creado_por = $1 AND estado != $2), 0) AS km,
          COALESCE((SELECT COUNT(id)::int FROM recorridos_rutas WHERE usuario_id = $1), 0) +
          COALESCE((SELECT COUNT(id)::int FROM rutas WHERE creado_por = $1 AND estado != $2), 0) AS rutas
        `,
        [id, 'Rechazada'],
      );

    const km = parseFloat(result[0]?.km ?? '0');

    const rutas = parseInt(
      result[0]?.rutas ?? '0',
      10,
    );

    const insignias =
      await this.insigniasService.contarInsigniasUsuario(
        id,
      );

    return {
      kmRecorridos: Math.round(km * 10) / 10,
      rutasCompletadas: rutas,
      insignias,
    };
  }

  /**
   * ADMINISTRACIÓN: APORTES
   *
   * Obtiene las rutas y nodos creados
   * por un usuario determinado.
   *
   * El acceso exclusivo para administradores
   * se aplica desde UserController.
   */
  async obtenerAportesUsuario(id: number) {
    await this.findOneUser(id);

    const [rutas, nodos] = await Promise.all([
      this.rutaRepository.find({
        where: {
          creadoPor: { id },
        },
        order: {
          creadoEn: 'DESC',
        },
      }),

      this.nodoRepository.find({
        where: {
          creadoPor: { id },
        },
        order: {
          creadoEn: 'DESC',
        },
      }),
    ]);

    return {
      usuarioId: id,

      resumen: {
        totalRutas: rutas.length,
        totalNodos: nodos.length,
        totalAportes: rutas.length + nodos.length,
      },

      rutas: rutas.map((ruta) => ({
        id: ruta.id,
        nombre: ruta.nombre,
        estado: ruta.estado,
        distanciaKm: ruta.distanciaKm,
        creadoEn: ruta.creadoEn,
      })),

      nodos: nodos.map((nodo) => ({
        id: nodo.id,
        nombre: nodo.nombre,
        categoria: nodo.categoria,
        estado: nodo.estado,
        creadoEn: nodo.creadoEn,
      })),
    };
  }

  /**
   * ADMINISTRACIÓN: HISTORIAL
   *
   * Consulta las interacciones registradas:
   * - Rutas favoritas.
   * - Votos en nodos.
   * - Votos en alertas.
   *
   * No devuelve entidades completas
   * ni información sensible.
   */
  async obtenerHistorialUsuario(id: number) {
    await this.findOneUser(id);

    const [favoritos, votosNodos, votosAlertas] =
      await Promise.all([
        this.rutaFavoritaRepository.find({
          where: {
            usuarioId: id,
          },
          order: {
            guardadoEn: 'DESC',
          },
        }),

        this.nodoVotoRepository.find({
          where: {
            usuarioId: id,
          },
          order: {
            creadoEn: 'DESC',
          },
        }),

        this.alertaVotoRepository.find({
          where: {
            usuarioId: id,
          },
          order: {
            creadoEn: 'DESC',
          },
        }),
      ]);

    const actividades: {
      tipo: string;
      referenciaId: number;
      accion: string;
      fecha: Date;
    }[] = [];

    for (const favorito of favoritos) {
      actividades.push({
        tipo: 'ruta_favorita',
        referenciaId: favorito.rutaId,
        accion: 'Ruta guardada como favorita',
        fecha: favorito.guardadoEn,
      });
    }

    for (const voto of votosNodos) {
      actividades.push({
        tipo: 'voto_nodo',
        referenciaId: voto.nodoId,
        accion: voto.tipo,
        fecha: voto.creadoEn,
      });
    }

    for (const voto of votosAlertas) {
      actividades.push({
        tipo: 'voto_alerta',
        referenciaId: voto.alertaId,
        accion: voto.tipo,
        fecha: voto.creadoEn,
      });
    }

    actividades.sort(
      (a, b) =>
        new Date(b.fecha).getTime() -
        new Date(a.fecha).getTime(),
    );

    return {
      usuarioId: id,

      resumen: {
        totalFavoritos: favoritos.length,
        totalVotosNodos: votosNodos.length,
        totalVotosAlertas: votosAlertas.length,
        totalInteracciones: actividades.length,
      },

      actividades,
    };
  }

  /**
   * ADMINISTRACIÓN: REPORTES
   *
   * Obtiene las alertas de incidencias
   * creadas por un usuario.
   *
   * Incluye resumen por estado y gravedad.
   *
   * No incluye denuncias de contenido:
   * esas pertenecen al módulo de moderación.
   */
  async obtenerReportesUsuario(id: number) {
    await this.findOneUser(id);

    const alertas = await this.alertaRepository.find({
      where: {
        creadoPor: { id },
      },
      order: {
        creadoEn: 'DESC',
      },
    });

    const porEstado: Record<string, number> = {};
    const porGravedad: Record<string, number> = {};

    for (const alerta of alertas) {
      const estado = String(alerta.estado);
      const gravedad = String(alerta.gravedad);

      porEstado[estado] = (porEstado[estado] ?? 0) + 1;
      porGravedad[gravedad] =
        (porGravedad[gravedad] ?? 0) + 1;
    }

    return {
      usuarioId: id,

      resumen: {
        totalReportes: alertas.length,
        porEstado,
        porGravedad,
      },

      reportes: alertas.map((alerta) => ({
        id: alerta.id,
        tipo: alerta.tipo,
        tipoOtro: alerta.tipoOtro,
        gravedad: alerta.gravedad,
        descripcion: alerta.descripcion,
        estado: alerta.estado,
        confirmacionesNo: alerta.confirmacionesNo,
        lat: alerta.lat,
        lng: alerta.lng,
        creadoEn: alerta.creadoEn,
        expiraEn: alerta.expiraEn,
      })),
    };
  }
}