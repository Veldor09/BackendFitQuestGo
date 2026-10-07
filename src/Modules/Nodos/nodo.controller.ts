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
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import {
  ActualizarNodoDto,
  CambiarEstadoNodoDto,
  CrearNodoDto,
  VotarNodoDto,
} from './dto/NodoDTO';
import { MAX_FOTO_BYTES } from './imagen.util';
import { Nodo } from './nodo.entity';
import { NodoConVotos, NodoService } from './nodo.service';

@Controller('nodos')
@UseGuards(GuardiaJwt)
export class NodoController {
  constructor(private readonly nodoService: NodoService) {}

  /**
   * Pines del mapa (HOM-01): cualquier usuario autenticado los ve, con el
   * recuento de votos y el suyo.
   */
  @Get()
  findAprobados(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<NodoConVotos[]> {
    return this.nodoService.findAprobados(actual.id);
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
    return this.nodoService.create(dto, actual.id, actual.rol);
  }

  /** Editar un Nodo de Abastecimiento propio (modulo 5). */
  @Patch(':id')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Empresa)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarNodoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Nodo> {
    return this.nodoService.actualizar(id, dto, actual);
  }

  /** Dar de baja un Nodo de Abastecimiento: su empresa o un admin. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<void> {
    return this.nodoService.eliminar(id, actual);
  }

  /**
   * Foto del punto (una, opcional). Va aparte de `POST /nodos` para no mezclar
   * el JSON validado con un archivo: la app crea el nodo y despues la sube.
   * Campo multipart `foto`; solo JPEG, PNG o WebP de hasta 3 MB.
   */
  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_FOTO_BYTES } }),
  )
  subirFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Nodo> {
    if (!foto) {
      throw new BadRequestException('Falta el archivo en el campo "foto"');
    }
    return this.nodoService.guardarFoto(id, foto.buffer, actual);
  }

  /** Bytes de la foto. Los pines aprobados los ve cualquiera; el resto, dueño y admin. */
  @Get(':id/foto')
  async verFoto(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenido, tipoMime } = await this.nodoService.obtenerFoto(
      id,
      actual,
    );
    res.set({
      'Content-Type': tipoMime,
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(contenido);
  }

  /**
   * NOD-04 "Sigue ahi": un voto por persona y solo estando a menos de 150 m:
   * 400 si estas lejos, 403 si lo propusiste vos, 409 si ya votaste o el punto
   * ya no esta en el mapa.
   */
  @Patch(':id/confirmar')
  @HttpCode(HttpStatus.OK)
  confirmar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VotarNodoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<NodoConVotos> {
    return this.nodoService.confirmar(id, actual.id, dto);
  }

  /** NOD-04 "Ya no existe": mismas reglas que "Sigue ahi"; con 3 votos sale del mapa. */
  @Patch(':id/obsoleto')
  @HttpCode(HttpStatus.OK)
  marcarObsoleto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VotarNodoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<NodoConVotos> {
    return this.nodoService.marcarObsoleto(id, actual.id, dto);
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
