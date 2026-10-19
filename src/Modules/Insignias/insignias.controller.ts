
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';

import {
  CrearInsigniaDto,
  EditarInsigniaDto,
} from './dto/administrar-insignia.dto';
import { InsigniaEstadoDto } from './dto/insignia-estado.dto';
import { Insignia } from './insignia.entity';
import { InsigniasService } from './insignias.service';

/**
 * Endpoints de insignias para usuarios autenticados.
 */
@Controller('insignias')
@UseGuards(GuardiaJwt)
export class InsigniasController {
  constructor(
    private readonly insigniasService: InsigniasService,
  ) {}

  /**
   * Consulta las insignias y el progreso
   * del usuario autenticado.
   */
  @Get('mias')
  obtenerMias(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InsigniaEstadoDto[]> {
    return this.insigniasService.obtenerInsigniasUsuario(actual.id);
  }
}

/**
 * Administración de insignias — ADM-10.
 *
 * Todos los endpoints requieren autenticación JWT
 * y el rol de administrador.
 */
@Controller('insignias/admin')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class AdminInsigniasController {
  constructor(
    private readonly insigniasService: InsigniasService,
  ) {}

  /**
   * Lista todas las insignias,
   * incluyendo las desactivadas.
   */
  @Get()
  listar(): Promise<Insignia[]> {
    return this.insigniasService.listarAdministracion();
  }

  /**
   * Consulta una insignia por su identificador.
   */
  @Get(':id')
  obtener(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Insignia> {
    return this.insigniasService.obtenerAdministracion(id);
  }

  /**
   * Crea una nueva insignia.
   */
  @Post()
  crear(
    @Body() dto: CrearInsigniaDto,
  ): Promise<Insignia> {
    return this.insigniasService.crearAdministracion(dto);
  }

  /**
   * Edita una insignia existente.
   *
   * Permite actualizar nombre, descripción,
   * emoji, tipo, métrica, meta y estado activo.
   *
   * El código no puede modificarse.
   */
  @Patch(':id')
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarInsigniaDto,
  ): Promise<Insignia> {
    return this.insigniasService.editarAdministracion(id, dto);
  }
}

/**
 * Consulta de insignias de otros usuarios.
 * Se conserva el endpoint existente.
 */
@Controller('usuarios')
@UseGuards(GuardiaJwt)
export class UsuarioInsigniasController {
  constructor(
    private readonly insigniasService: InsigniasService,
  ) {}

  @Get(':id/insignias')
  obtenerDeUsuario(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InsigniaEstadoDto[]> {
    return this.insigniasService.obtenerInsigniasUsuario(id);
  }
}
