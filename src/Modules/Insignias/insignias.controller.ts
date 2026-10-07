import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { InsigniasService } from './insignias.service';
import { InsigniaEstadoDto } from './dto/insignia-estado.dto';

@Controller('insignias')
@UseGuards(GuardiaJwt)
export class InsigniasController {
  constructor(private readonly insigniasService: InsigniasService) {}

  @Get('mias')
  obtenerMias(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<InsigniaEstadoDto[]> {
    return this.insigniasService.obtenerInsigniasUsuario(actual.id);
  }
}

@Controller('usuarios')
@UseGuards(GuardiaJwt)
export class UsuarioInsigniasController {
  constructor(private readonly insigniasService: InsigniasService) {}

  @Get(':id/insignias')
  obtenerDeUsuario(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InsigniaEstadoDto[]> {
    return this.insigniasService.obtenerInsigniasUsuario(id);
  }
}
