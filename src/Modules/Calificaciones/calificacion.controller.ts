import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { TipoCalificable } from './calificacion.enum';
import {
  CalificacionService,
  ResumenCalificacion,
  ResumenEvento,
} from './calificacion.service';
import { CalificarDto } from './dto/CalificacionDTO';

@Controller('calificaciones')
@UseGuards(GuardiaJwt)
export class CalificacionController {
  constructor(private readonly calificacionService: CalificacionService) {}

  @Get(':tipo/:id')
  resumen(
    @Param('tipo', new ParseEnumPipe(TipoCalificable)) tipo: TipoCalificable,
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion | ResumenEvento> {
    return this.calificacionService.resumen(tipo, id, actual);
  }

  @Put(':tipo/:id')
  @HttpCode(HttpStatus.OK)
  calificar(
    @Param('tipo', new ParseEnumPipe(TipoCalificable)) tipo: TipoCalificable,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CalificarDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion | ResumenEvento> {
    return this.calificacionService.calificar(tipo, id, dto, actual);
  }
}
