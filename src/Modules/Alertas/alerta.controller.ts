import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { Alerta } from './alerta.entity';
import { AlertaConVoto, AlertaService } from './alerta.service';
import {
  CambiarEstadoAlertaDto,
  CrearAlertaDto,
  VotarAlertaDto,
} from './dto/AlertaDTO';

/**
 * A diferencia de /nodos, aca no hay ruta ".../pendientes": el mismo listado
 * sirve para el mapa del usuario (HOM-01) y para la supervision del admin
 * (ADM-06), porque una alerta se publica de inmediato.
 */
@Controller('alertas')
@UseGuards(GuardiaJwt)
export class AlertaController {
  constructor(private readonly alertaService: AlertaService) {}

  @Get('mias')
  findMisAlertas(@UsuarioActual() actual: UsuarioAutenticado): Promise<Alerta[]> {
    return this.alertaService.findMisAlertas(actual.id);
  }

  @Get()
  findActivas(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<AlertaConVoto[]> {
    return this.alertaService.findActivas(actual.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Alerta> {
    return this.alertaService.findOne(id);
  }

  /** Reportar alerta (ALR-01/02/03): cualquier usuario autenticado, sin moderacion previa. */
  @Post()
  create(
    @Body() dto: CrearAlertaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Alerta> {
    return this.alertaService.create(dto, actual.id);
  }

  /**
   * ALR-04 "Confirmar": sigue vigente. Un voto por persona y solo estando a
   * menos de 150 m: 400 si estas lejos, 409 si ya votaste o la alerta se cerro.
   */
  @Patch(':id/confirmar')
  @HttpCode(HttpStatus.OK)
  confirmar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VotarAlertaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<AlertaConVoto> {
    return this.alertaService.confirmar(id, actual.id, dto);
  }

  /**
   * ALR-04/05 "Ya no esta": suma una duda, se autorresuelve al llegar al
   * umbral. Mismas reglas de voto unico y cercania que "Confirmar".
   */
  @Patch(':id/desmentir')
  @HttpCode(HttpStatus.OK)
  desmentir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VotarAlertaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<AlertaConVoto> {
    return this.alertaService.desmentir(id, actual.id, dto);
  }

  /** ADM-06 "Marcar resuelta": solo admin. */
  @Patch(':id/estado')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoAlertaDto,
  ): Promise<Alerta> {
    return this.alertaService.cambiarEstado(id, dto.estado);
  }

  /** ADM-06 "Eliminar": solo admin. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.alertaService.eliminar(id);
  }
}
