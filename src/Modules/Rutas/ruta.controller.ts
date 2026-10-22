import {
  Body,
  BadRequestException,
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
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { CambiarEstadoRutaDto, CrearRutaDto } from './dto/RutaDTO';
import { CrearRecorridoDto } from './dto/CrearRecorridoDTO';
import { RecorridoRuta } from './recorrido-ruta.entity';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

@Controller('rutas')
@UseGuards(GuardiaJwt)
export class RutaController {
  constructor(private readonly rutaService: RutaService) {}

  @Get('explorar')
  findPublicadas(@UsuarioActual() actual: UsuarioAutenticado): Promise<Ruta[]> {
    return this.rutaService.findPublicadas(actual.rol);
  }

  @Get('mias')
  findMisRutas(@UsuarioActual() actual: UsuarioAutenticado): Promise<Ruta[]> {
    return this.rutaService.findMisRutas(actual.id);
  }

  /** Rutas guardadas / favoritas del usuario (RTE-03). */
  @Get('favoritas')
  findFavoritas(@UsuarioActual() actual: UsuarioAutenticado): Promise<Ruta[]> {
    return this.rutaService.findFavoritas(actual.id, actual.rol);
  }

  /** Lista de IDs de rutas favoritas para la UI. */
  @Get('favoritas/ids')
  findFavoritasIds(
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<number[]> {
    return this.rutaService.findFavoritasIds(actual.id);
  }

  /** Alternar favorita (guardar/remover). */
  @Post(':id/favorita')
  toggleFavorita(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<{ favorita: boolean }> {
    return this.rutaService.toggleFavorita(id, actual.id, actual.rol);
  }

  @Get('pendientes')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  findPendientes(): Promise<Ruta[]> {
    return this.rutaService.findPendientes();
  }

  /** Una ruta publicada la ve cualquiera; el resto, solo su dueno y el admin. */
  @Get(':id')
  verRuta(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    return this.rutaService.verRuta(id, actual);
  }

  /** Planificar/registrar una ruta (RTE-06/07): cualquier usuario autenticado. */
  @Post()
  create(
    @Body() dto: CrearRutaDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    return this.rutaService.create(dto, actual.id);
  }

  /** Publica una ruta privada de inmediato (sin moderacion). */
  @Patch(':id/publicar')
  solicitarPublicacion(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    return this.rutaService.solicitarPublicacion(id, actual.id);
  }


  /**
   * Foto de la ruta (una, opcional). Va aparte de `POST /rutas` para no mezclar el
   * JSON validado con un archivo. Campo multipart `foto`; solo JPEG, PNG o
   * WebP de hasta 3 MB.
   */
  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_FOTO_BYTES } }),
  )
  subirFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<Ruta> {
    if (!foto) {
      throw new BadRequestException('Falta el archivo en el campo "foto"');
    }
    return this.rutaService.guardarFoto(id, foto.buffer, actual);
  }

  /** Bytes de la foto. */
  @Get(':id/foto')
  async verFoto(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenido, tipoMime } = await this.rutaService.obtenerFoto(id, actual);
    res.set({
      'Content-Type': tipoMime,
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(contenido);
  }

  /** Eliminar una ruta: su dueno o un admin. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<void> {
    return this.rutaService.eliminar(id, actual);
  }

  /** Retirar una ruta (ADM-05): solo admin. Ya no se aprueban: se publican solas. */
  @Patch(':id/estado')
  @UseGuards(GuardiaRoles)
  @Roles(RoleId.Admin)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoRutaDto,
  ): Promise<Ruta> {
    return this.rutaService.cambiarEstado(id, dto.estado);
  }

  /** Registrar recorrido de una ruta completada (RTE-08). */
  @Post(':id/recorridos')
  registrarRecorrido(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearRecorridoDto,
    @UsuarioActual() actual: UsuarioAutenticado,
  ): Promise<RecorridoRuta> {
    return this.rutaService.registrarRecorrido(id, actual.id, dto);
  }
}
