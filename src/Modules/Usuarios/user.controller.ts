
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

@Controller('usuarios')
@UseGuards(GuardiaJwt, GuardiaRoles)
export class UserController {
  constructor(
    private readonly userService: UserService,
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
   * Registra un nuevo usuario.
   */
  @Post()
  @Roles(RoleId.Admin)
  create(
    @Body() dto: CreateUserDto,
  ): Promise<User> {
    return this.userService.createUser(dto);
  }

  /**
   * Actualiza la informacion de un usuario.
   */
  @Put(':id')
  update(
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

    // Un usuario normal no puede cambiar su rol.
    if (!esAdmin && dto.idrol !== undefined) {
      delete dto.idrol;
    }

    // Un administrador no puede quitarse
    // a si mismo el rol de administrador.
    if (
      id === actual.id &&
      dto.idrol !== undefined &&
      dto.idrol !== RoleId.Admin
    ) {
      throw new ForbiddenException(
        'No puedes quitarte tu propio rol de Admin',
      );
    }

    return this.userService.updateUser(id, dto);
  }

  /**
   * ADMINISTRACION
   *
   * Activa o desactiva una cuenta
   * sin eliminar sus datos.
   */
  @Patch(':id/estado')
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    // Un administrador no puede
    // desactivar su propia cuenta.
    if (
      id === actual.id &&
      dto.estado === EstadoUsuario.Desactivado
    ) {
      throw new ForbiddenException(
        'No puedes desactivar tu propia cuenta',
      );
    }

    return this.userService.cambiarEstado(
      id,
      dto.estado,
    );
  }
}
