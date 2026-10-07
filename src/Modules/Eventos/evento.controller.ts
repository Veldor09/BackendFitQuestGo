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
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { ActualizarEventoDto, CrearEventoDto } from './dto/EventoDTO';
import { Evento } from './evento.entity';
import { EventoService } from './evento.service';

@Controller('eventos')
@UseGuards(GuardiaJwt)
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  /** Eventos vigentes y futuros: los ve cualquier usuario autenticado. */
  @Get()
  findVigentes(): Promise<Evento[]> {
    return this.eventoService.findVigentes();
  }

  /** Panel de la empresa: todos sus eventos, tambien los ya terminados. */
  @Get('mios')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  findMios(@UsuarioActual() actual: UsuarioAutenticado): Promise<Evento[]> {
    return this.eventoService.findMios(actual.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Evento> {
    return this.eventoService.findOne(id);
  }

  @Post()
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  create(
    @Body() dto: CrearEventoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Evento> {
    return this.eventoService.create(dto, actual.id);
  }

  @Patch(':id')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEventoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Evento> {
    return this.eventoService.actualizar(id, dto, actual);
  }

  /** La empresa dueña o un admin. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<void> {
    return this.eventoService.eliminar(id, actual);
  }
}
