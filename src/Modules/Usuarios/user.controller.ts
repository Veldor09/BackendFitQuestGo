
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  CambiarEstadoDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/UserDTO';

import { EstadoUsuario } from './estado.enum';
import { User } from './user.entity';
import { UserService } from './user.service';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';

import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';

import { RoleId } from './roles.enum';
import { AuditoriaService } from '../Auditoria/auditoria.service';

/**
 * Campos permitidos en el historial de auditoría.
 *
 * No incluir contraseñas, tokens, hashes ni
 * información sensible en esta lista.
 */
const CAMPOS_AUDITABLES = [
  'nombreUser',
  'emailUser',
  'telefono',
  'idrol',
  'estado',
] as const;

type CampoAuditable =
  (typeof CAMPOS_AUDITABLES)[number];

type CambioAuditoria = {
  anterior: unknown;
  nuevo: unknown;
};

/**
 * Construye un resumen de los campos modificados.
 *
 * Solo compara campos expresamente autorizados.
 */
function obtenerCambiosUsuario(
  anterior: User,
  nuevo: User,
): Record<string, CambioAuditoria> {
  const cambios: Record<string, CambioAuditoria> = {};

  for (const campo of CAMPOS_AUDITABLES) {
    const valorAnterior = anterior[campo];
    const valorNuevo = nuevo[campo];

    if (valorAnterior !== valorNuevo) {
      cambios[campo] = {
        anterior: valorAnterior ?? null,
        nuevo: valorNuevo ?? null,
      };
    }
  }

  return cambios;
}

@Controller('usuarios')
@UseGuards(GuardiaJwt, GuardiaRoles)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditoriaService: AuditoriaService,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * ADMINISTRACION
   * Lista todos los usuarios registrados.
   */
  @Get()
  @Roles(RoleId.Admin)
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  /**
   * PRF-01 / BDG-01 / NAV-07
   * Metricas del usuario autenticado.
   */
  @Get('yo/estadisticas')
  estadisticasMias(
    @UsuarioActual() actual: UsuarioAutenticado,
  ) {
    return this.userService.estadisticas(actual.id);
  }

  /**
   * ADMINISTRACION: APORTES
   *
   * Consulta las rutas y nodos creados
   * por un usuario.
   *
   * Solo disponible para administradores.
   */
  @Get(':id/aportes')
  @Roles(RoleId.Admin)
  obtenerAportesUsuario(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.obtenerAportesUsuario(id);
  }

  /**
   * ADMINISTRACION: HISTORIAL
   *
   * Consulta las interacciones de un usuario:
   * - Rutas favoritas.
   * - Votos en nodos.
   * - Votos en alertas.
   *
   * Solo disponible para administradores.
   */
  @Get(':id/historial')
  @Roles(RoleId.Admin)
  obtenerHistorialUsuario(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.obtenerHistorialUsuario(id);
  }

  /**
   * ADMINISTRACION: REPORTES
   *
   * Consulta las alertas de incidencias
   * creadas por un usuario.
   *
   * Incluye:
   * - Total de reportes.
   * - Resumen por estado.
   * - Resumen por gravedad.
   * - Listado de alertas.
   *
   * No incluye denuncias de contenido
   * del modulo de moderacion.
   *
   * Solo disponible para administradores.
   */
  @Get(':id/reportes')
  @Roles(RoleId.Admin)
  obtenerReportesUsuario(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.obtenerReportesUsuario(id);
  }

  /**
   * Consulta la informacion de un usuario.
   *
   * Un administrador puede consultar
   * cualquier usuario.
   *
   * Un usuario normal solamente puede
   * consultar su propia informacion.
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    if (
      actual.rol !== RoleId.Admin &&
      actual.id !== id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para ver este usuario',
      );
    }

    return this.userService.findOneUser(id);
  }

  /**
   * ADMINISTRACION
   *
   * Registra un nuevo usuario y su auditoria
   * dentro de una unica transaccion.
   *
   * Si falla cualquiera de las operaciones,
   * se revierten ambas.
   *
   * Guarda únicamente los datos básicos
   * permitidos en el historial.
   */
  @Post()
  @Roles(RoleId.Admin)
  async create(
    @Body() dto: CreateUserDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const usuario = await this.userService.createUser(
        dto,
        manager,
      );

      const datosRegistrados: Record<string, unknown> = {};

      for (const campo of CAMPOS_AUDITABLES) {
        datosRegistrados[campo] =
          usuario[campo] ?? null;
      }

      await this.auditoriaService.registrar(
        {
          administradorId: actual.id,
          accion: 'USUARIO_CREADO',
          entidad: 'USUARIO',
          entidadId: usuario.id,
          detalle: {
            datosRegistrados,
          },
        },
        manager,
      );

      return usuario;
    });
  }

  /**
   * Actualiza la informacion de un usuario.
   *
   * Los administradores generan un registro
   * de auditoria en la misma transaccion.
   *
   * Las actualizaciones de usuarios normales
   * conservan su funcionamiento existente.
   *
   * El historial guarda únicamente los campos
   * que cambiaron y sus valores anterior/nuevo.
   */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    const esAdmin = actual.rol === RoleId.Admin;

    if (!esAdmin && id !== actual.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este usuario',
      );
    }

    if (!esAdmin && dto.idrol !== undefined) {
      delete dto.idrol;
    }

    if (
      id === actual.id &&
      dto.idrol !== undefined &&
      dto.idrol !== RoleId.Admin
    ) {
      throw new ForbiddenException(
        'No puedes quitarte tu propio rol de Admin',
      );
    }

    if (!esAdmin) {
      return this.userService.updateUser(id, dto);
    }

    return this.dataSource.transaction(async (manager) => {
      /**
       * Consultamos el estado original dentro
       * de la misma transacción.
       */
      const usuarioAnterior =
        await this.userService.findOneUser(
          id,
          manager,
        );

      /**
       * Guardamos una copia independiente
       * de los valores auditables antes
       * de actualizar la entidad.
       */
      const valoresAnteriores = {
        ...usuarioAnterior,
      } as User;

      /**
       * Actualizamos el usuario utilizando
       * el servicio existente.
       */
      const usuarioActualizado =
        await this.userService.updateUser(
          id,
          dto,
          manager,
        );

      /**
       * Comparamos los valores originales
       * con los valores finalmente guardados.
       */
      const cambios = obtenerCambiosUsuario(
        valoresAnteriores,
        usuarioActualizado,
      );

      /**
       * Nunca guardamos la contraseña ni
       * su hash. Solo indicamos que cambió.
       */
      const contrasenaModificada =
        dto.passwordUserHash !== undefined &&
        dto.passwordUserHash !== '';

      const detalle: Record<string, unknown> = {
        cambios,
      };

      if (contrasenaModificada) {
        detalle.contrasenaModificada = true;
      }

      await this.auditoriaService.registrar(
        {
          administradorId: actual.id,
          accion: 'USUARIO_ACTUALIZADO',
          entidad: 'USUARIO',
          entidadId: id,
          detalle,
        },
        manager,
      );

      return usuarioActualizado;
    });
  }

  /**
   * ADMINISTRACION
   *
   * Activa o desactiva una cuenta
   * sin eliminar sus datos.
   *
   * El cambio de estado y la auditoria
   * se ejecutan en una unica transaccion.
   *
   * Registra el estado anterior y nuevo.
   */
  @Patch(':id/estado')
  @Roles(RoleId.Admin)
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    if (
      id === actual.id &&
      dto.estado === EstadoUsuario.Desactivado
    ) {
      throw new ForbiddenException(
        'No puedes desactivar tu propia cuenta',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      /**
       * Consultar el estado anterior.
       */
      const usuarioAnterior =
        await this.userService.findOneUser(
          id,
          manager,
        );

      const estadoAnterior = usuarioAnterior.estado;

      /**
       * Aplicar el cambio de estado.
       */
      const usuario =
        await this.userService.cambiarEstado(
          id,
          dto.estado,
          manager,
        );

      /**
       * Registrar la diferencia.
       */
      const cambios: Record<string, CambioAuditoria> = {};

      if (estadoAnterior !== usuario.estado) {
        cambios.estado = {
          anterior: estadoAnterior ?? null,
          nuevo: usuario.estado ?? null,
        };
      }

      await this.auditoriaService.registrar(
        {
          administradorId: actual.id,
          accion: 'ESTADO_USUARIO_CAMBIADO',
          entidad: 'USUARIO',
          entidadId: id,
          detalle: {
            cambios,
          },
        },
        manager,
      );

      return usuario;
    });
  }
}
