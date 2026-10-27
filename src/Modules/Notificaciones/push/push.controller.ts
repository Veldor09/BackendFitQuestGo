import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GuardiaJwt } from '../../Auth/guards/jwt.guard';
import { UsuarioActual } from '../../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../Auth/types/carga-jwt';
import {
  QuitarDispositivoDto,
  RegistrarDispositivoDto,
} from './dispositivo-push.dto';
import { PushService } from './push.service';

/** La app avisa aqui cuando este telefono acepta (o deja de aceptar) avisos. */
@Controller('notificaciones/push')
@UseGuards(GuardiaJwt)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('dispositivo')
  @HttpCode(HttpStatus.OK)
  registrar(
    @UsuarioActual() actual: UsuarioAutenticado,
    @Body() dto: RegistrarDispositivoDto,
  ): Promise<{ registrado: true }> {
    return this.push.registrar(actual.id, dto);
  }

  @Post('dispositivo/baja')
  @HttpCode(HttpStatus.OK)
  quitar(
    @UsuarioActual() actual: UsuarioAutenticado,
    @Body() dto: QuitarDispositivoDto,
  ): Promise<{ eliminado: true }> {
    return this.push.quitar(actual.id, dto.token);
  }
}
