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
import { CambiarEstadoDto, CreateUserDto, UpdateUserDto } from './dto/UserDTO';
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
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(RoleId.Admin)
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  /** PRF-01 / BDG-01 / NAV-07: Metricas del usuario autenticado. */
  @Get('yo/estadisticas')
  estadisticasMias(@UsuarioActual() actual: UsuarioAutenticado) {
    return this.userService.estadisticas(actual.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    if (actual.rol !== RoleId.Admin && actual.id !== id) {
      throw new ForbiddenException('No tienes permiso para ver este usuario');
    }
    return this.userService.findOneUser(id);
  }

  @Post()
  @Roles(RoleId.Admin)
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.createUser(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    const esAdmin = actual.rol === RoleId.Admin;
    if (!esAdmin && id !== actual.id) {
      throw new ForbiddenException('No tienes permiso para modificar este usuario');
    }

    // Un usuario normal no puede cambiarse su propio rol
    if (!esAdmin && dto.idrol !== undefined) {
      delete dto.idrol;
    }

    // Un admin no puede quitarse a si mismo el rol de Admin.
    if (
      id === actual.id &&
      dto.idrol !== undefined &&
      dto.idrol !== RoleId.Admin
    ) {
      throw new ForbiddenException('No puedes quitarte tu propio rol de Admin');
    }
    return this.userService.updateUser(id, dto);
  }

  /** Baja / alta logica de una cuenta (antes: DELETE /usuarios/:id). */
  @Patch(':id/estado')
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<User> {
    // Un usuario no puede desactivar su propia cuenta.
    if (id === actual.id && dto.estado === EstadoUsuario.Desactivado) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    }
    return this.userService.cambiarEstado(id, dto.estado);
  }

}
