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
import { CrearReporteContenidoDto } from './dto/crear-reporte-contenido.dto';
import { CambiarEstadoReporteContenidoDto } from './dto/cambiar-estado-reporte-contenido.dto';
import { ReporteContenido } from './reporte-contenido.entity';
import { ReporteContenidoService } from './reporte-contenido.service';

@Controller('reportes-contenido')
@UseGuards(GuardiaJwt)
export class ReporteContenidoController {
  constructor(
    private readonly reporteService: ReporteContenidoService,
  ) {}

  @Post()
  crear(
    @Body() dto: CrearReporteContenidoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<ReporteContenido> {
    return this.reporteService.crear(dto, actual.id);
  }

  @Get()
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  listar(): Promise<ReporteContenido[]> {
    return this.reporteService.listar();
  }

  @Get(':id')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  obtener(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReporteContenido> {
    return this.reporteService.obtener(id);
  }

  @Patch(':id/estado')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoReporteContenidoDto,
  ): Promise<ReporteContenido> {
    return this.reporteService.cambiarEstado(id, dto.estado);
  }
}
