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
import { CambiarEstadoRutaDto, CrearRutaDto } from './dto/RutaDTO';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

@Controller('rutas')
@UseGuards(GuardiaJwt)
export class RutaController {
  constructor(private readonly rutaService: RutaService) {}

  @Get('explorar')
  findPublicadas(): Promise<Ruta[]> {
    return this.rutaService.findPublicadas();
  }

  @Get('mias')
  findMisRutas(@UsuarioActual() actual: UsuarioAutenticado): Promise<Ruta[]> {
    return this.rutaService.findMisRutas(actual.id);
  }

  @Get('pendientes')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  findPendientes(): Promise<Ruta[]> {
    return this.rutaService.findPendientes();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Ruta> {
    return this.rutaService.findOne(id);
  }

  /** Planificar/registrar una ruta (RTE-06/07): cualquier usuario autenticado. */
  @Post()
  create(
    @Body() dto: CrearRutaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    return this.rutaService.create(dto, actual.id);
  }

  @Patch(':id/publicar')
  solicitarPublicacion(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    return this.rutaService.solicitarPublicacion(id, actual.id);
  }

  /** Aprobar / rechazar (ADM-05): solo admin. */
  @Patch(':id/estado')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoRutaDto,
  ): Promise<Ruta> {
    return this.rutaService.cambiarEstado(id, dto.estado);
  }
}
