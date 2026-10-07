import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import type { ResultadoAuth } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { RegistroEmpresaDto } from './dto/registro-empresa.dto';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { RenovarDto } from './dto/renovar.dto';
import { OlvideContrasenaDto } from './dto/olvide-contrasena.dto';
import { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto';
import { UpdateUserDto } from '../Usuarios/dto/UserDTO';
import { ActualizarPerfilEmpresaDto } from './dto/actualizar-perfil-empresa.dto';
import { Roles } from './decorators/roles.decorator';
import { GuardiaJwt } from './guards/jwt.guard';
import { GuardiaRoles } from './guards/roles.guard';
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { RoleId } from '../Usuarios/roles.enum';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from './types/carga-jwt';
import type { User } from '../Usuarios/user.entity';

const COOKIE_ACCESS = 'access_token';
const COOKIE_REFRESH = 'refresh_token';
const RUTA_REFRESH = '/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AuthConfig,
  ) {}

  @Post('registro')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registro(
    @Body() dto: RegistroDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.authService.registrar(
      dto,
      this.datosCliente(req),
    );
    this.escribirCookies(res, resultado);
    return this.cuerpoRespuesta(req, resultado);
  }

  @Post('registro-empresa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registroEmpresa(
    @Body() dto: RegistroEmpresaDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.authService.registrarEmpresa(
      dto,
      this.datosCliente(req),
    );
    this.escribirCookies(res, resultado);
    return this.cuerpoRespuesta(req, resultado);
  }

  @Post('inicio-sesion')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async inicioSesion(
    @Body() dto: InicioSesionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.authService.iniciarSesion(
      dto,
      this.datosCliente(req),
    );
    this.escribirCookies(res, resultado);
    return this.cuerpoRespuesta(req, resultado);
  }

  @Post('renovar')
  @HttpCode(HttpStatus.OK)
  async renovar(
    @Body() dto: RenovarDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenPlano = this.leerRefresh(req, dto);
    if (!tokenPlano) {
      throw new UnauthorizedException('Falta el refresh token');
    }
    const resultado = await this.authService.renovar(
      tokenPlano,
      this.datosCliente(req),
    );
    this.escribirCookies(res, resultado);
    return this.cuerpoRespuesta(req, resultado);
  }

  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuardiaJwt)
  async cerrarSesion(
    @Body() dto: RenovarDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    await this.authService.cerrarSesion(
      cookies?.[COOKIE_REFRESH] ?? dto.refreshToken,
    );
    this.limpiarCookies(res);
  }

  @Post('cerrar-todo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuardiaJwt)
  async cerrarTodo(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.cerrarTodo(usuario.id);
    this.limpiarCookies(res);
  }

  @Get('yo')
  @UseGuards(GuardiaJwt)
  yo(@UsuarioActual() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }

  @Get('perfil')
  @UseGuards(GuardiaJwt)
  perfil(@UsuarioActual() usuario: UsuarioAutenticado): Promise<User> {
    return this.authService.obtenerPerfil(usuario.id);
  }

  @Put('perfil')
  @UseGuards(GuardiaJwt)
  actualizarPerfil(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    const { idrol, terminosAceptadosEn, ...cambiosPermitidos } = dto;
    return this.authService.actualizarPerfil(usuario.id, cambiosPermitidos);
  }

  /** Una empresa cambia su nombre comercial y su telefono. */
  @Patch('perfil-empresa')
  @UseGuards(GuardiaJwt, GuardiaRoles)
  @Roles(RoleId.Empresa)
  actualizarPerfilEmpresa(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() dto: ActualizarPerfilEmpresaDto,
  ) {
    return this.authService.actualizarPerfilEmpresa(usuario.id, dto);
  }

  /**
   * Foto de perfil propia (una). Campo multipart `foto`; solo JPEG, PNG o WebP
   * de hasta 3 MB.
   */
  @Post('perfil/foto')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuardiaJwt)
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_FOTO_BYTES } }),
  )
  async subirFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @UploadedFile() foto: Express.Multer.File | undefined,
  ): Promise<void> {
    if (!foto) {
      throw new BadRequestException('Falta el archivo en el campo "foto"');
    }
    await this.authService.guardarFoto(usuario.id, foto.buffer);
  }

  @Get('perfil/foto')
  @UseGuards(GuardiaJwt)
  async verFoto(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenido, tipoMime } = await this.authService.obtenerFoto(
      usuario.id,
    );
    res.set({
      'Content-Type': tipoMime,
      // Sin cache: al cambiar la foto la app tiene que ver la nueva enseguida.
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(contenido);
  }

  @Delete('perfil/foto')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuardiaJwt)
  async quitarFoto(@UsuarioActual() usuario: UsuarioAutenticado): Promise<void> {
    await this.authService.quitarFoto(usuario.id);
  }

  @Post('olvide-contrasena')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async olvideContrasena(@Body() dto: OlvideContrasenaDto): Promise<void> {
    await this.authService.olvideContrasena(dto.email);
  }

  @Post('restablecer-contrasena')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async restablecerContrasena(
    @Body() dto: RestablecerContrasenaDto,
  ): Promise<void> {
    await this.authService.restablecerContrasena(dto);
  }

  private cuerpoRespuesta(
    req: Request,
    resultado: ResultadoAuth,
  ): {
    usuario: ResultadoAuth['usuario'];
    accessToken: string;
    refreshToken?: string;
  } {
    const cuerpo = {
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
    };
    if (req.headers['x-cliente-movil'] === '1') {
      return { ...cuerpo, refreshToken: resultado.refreshToken };
    }
    return cuerpo;
  }

  private datosCliente(req: Request): {
    agenteUsuario: string | null;
    ip: string | null;
  } {
    return {
      agenteUsuario: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    };
  }

  private leerRefresh(req: Request, dto: RenovarDto): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_REFRESH] ?? dto.refreshToken;
  }

  private escribirCookies(res: Response, resultado: ResultadoAuth): void {
    res.cookie(COOKIE_ACCESS, resultado.accessToken, {
      httpOnly: true,
      secure: this.config.cookieSegura,
      sameSite: 'lax',
      path: '/',
    });
    res.cookie(COOKIE_REFRESH, resultado.refreshToken, {
      httpOnly: true,
      secure: this.config.cookieSegura,
      sameSite: 'lax',
      path: RUTA_REFRESH,
      expires: resultado.refreshExpiraEn,
    });
  }

  private limpiarCookies(res: Response): void {
    res.clearCookie(COOKIE_ACCESS, { path: '/' });
    res.clearCookie(COOKIE_REFRESH, { path: RUTA_REFRESH });
  }
}
