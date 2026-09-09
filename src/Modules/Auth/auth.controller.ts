import {Body,Controller,Get,HttpCode,HttpStatus,Post,Req,Res,UnauthorizedException,UseGuards,} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {Request,Response,} from 'express';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import type { ResultadoAuth } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { RenovarDto } from './dto/renovar.dto';
import { GuardiaJwt } from './guards/jwt.guard';
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

  private cuerpoRespuesta(
    req: Request,
    resultado: ResultadoAuth,
  ): { usuario: ResultadoAuth['usuario']; accessToken: string; refreshToken?: string } {
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
