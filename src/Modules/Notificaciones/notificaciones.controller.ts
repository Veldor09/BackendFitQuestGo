import {
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
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionRespuestaDto } from './dto/notificacion.dto';

@Controller('notificaciones')
@UseGuards(GuardiaJwt)
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Get('no-leidas/conteo')
  contarNoLeidas(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<{ conteo: number }> {
    return this.notificacionesService.contarNoLeidas(actual.id);
  }

  @Post('leer-todas')
  @HttpCode(HttpStatus.OK)
  marcarTodasLeidas(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<{ actualizadas: number }> {
    return this.notificacionesService.marcarTodasLeidas(actual.id);
  }

  @Get()
  findMisNotificaciones(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<NotificacionRespuestaDto[]> {
    return this.notificacionesService.findMisNotificaciones(actual.id);
  }

  @Patch(':id/leer')
  marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<NotificacionRespuestaDto> {
    return this.notificacionesService.marcarLeida(id, actual.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<void> {
    return this.notificacionesService.eliminar(id, actual.id);
  }
}
