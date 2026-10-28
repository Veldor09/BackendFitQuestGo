import {
  BadRequestException,
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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../Auth/decorators/roles.decorator';
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { DestacadosService } from '../Patrocinio/destacados.service';
import type {
  ConDestacado,
  ResultadoDestacar,
} from '../Patrocinio/destacados.service';
import { DestacarDto } from '../Patrocinio/dto/destacar.dto';
import { RoleId } from '../Usuarios/roles.enum';
import { ActualizarEventoDto, CrearEventoDto } from './dto/EventoDTO';
import { Evento } from './evento.entity';
import { EventoService } from './evento.service';

@Controller('eventos')
@UseGuards(GuardiaJwt)
export class EventoController {
  constructor(
    private readonly eventoService: EventoService,
    private readonly destacados: DestacadosService,
  ) {}

  /**
   * Eventos vigentes y futuros: los ve cualquier usuario autenticado, con
   * `destacado` (los destacados primero).
   */
  @Get()
  async findVigentes(): Promise<ConDestacado<Evento>[]> {
    return this.destacados.eventosConDestacado(
      await this.eventoService.findVigentes(),
    );
  }

  /** Panel de la empresa: todos sus eventos, tambien los ya terminados. */
  @Get('mios')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  async findMios(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<ConDestacado<Evento>[]> {
    return this.destacados.eventosConDestacado(
      await this.eventoService.findMios(actual.id),
    );
  }

  /** Enciende o apaga "Destacar" en un evento propio (solo empresas). */
  @Patch(':id/destacar')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  destacar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DestacarDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<ResultadoDestacar> {
    return this.destacados.destacarEvento(id, actual, dto.destacar);
  }

  /**
   * ADM-08: listado completo para administradores.
   * Incluye eventos futuros, en curso y finalizados.
   *
   * Debe declararse antes de @Get(':id').
   */
  @Get('admin/todos')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  findTodosAdmin(): Promise<Evento[]> {
    return this.eventoService.findTodosAdmin();
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

  @Post(':id/foto')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_FOTO_BYTES } }),
  )
  subirFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Evento> {
    if (!foto) {
      throw new BadRequestException('Falta el archivo en el campo "foto"');
    }
    return this.eventoService.guardarFoto(id, foto.buffer, actual);
  }

  @Get(':id/foto')
  async verFoto(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenido, tipoMime } = await this.eventoService.obtenerFoto(
      id,
      actual,
    );
    res.set({
      'Content-Type': tipoMime,
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(contenido);
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
