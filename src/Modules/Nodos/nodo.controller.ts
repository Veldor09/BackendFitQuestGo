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
import { CambiarEstadoNodoDto, CrearNodoDto } from './dto/NodoDTO';
import { Nodo } from './nodo.entity';
import { NodoService } from './nodo.service';

@Controller('nodos')
@UseGuards(GuardiaJwt)
export class NodoController {
  constructor(private readonly nodoService: NodoService) {}

  /** Pines del mapa (HOM-01): cualquier usuario autenticado los ve. */
  @Get()
  findAprobados(): Promise<Nodo[]> {
    return this.nodoService.findAprobados();
  }

  @Get('mios')
  findMisNodos(@UsuarioActual() actual: UsuarioAutenticado): Promise<Nodo[]> {
    return this.nodoService.findMisNodos(actual.id);
  }

  @Get('pendientes')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  findPendientes(): Promise<Nodo[]> {
    return this.nodoService.findPendientes();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Nodo> {
    return this.nodoService.findOne(id);
  }

  /** Proponer un punto de interes (NOD-01/02): cualquier usuario autenticado. */
  @Post()
  create(
    @Body() dto: CrearNodoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Nodo> {
    return this.nodoService.create(dto, actual.id);
  }

  /** Aprobar / rechazar (ADM-07): solo admin. */
  @Patch(':id/estado')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoNodoDto,
  ): Promise<Nodo> {
    return this.nodoService.cambiarEstado(id, dto.estado);
  }
}
