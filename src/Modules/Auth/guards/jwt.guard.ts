import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthConfig } from '../auth.config';
import { CargaJwt } from '../types/carga-jwt';
import { RequestAutenticado } from '../types/request-autenticado';

@Injectable()
export class GuardiaJwt implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequestAutenticado>();
    const token = this.extraerToken(req);
    if (!token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }
    try {
      const carga = await this.jwt.verifyAsync<CargaJwt>(token, {
        secret: this.config.secretoAccessToken,
      });
      req.usuario = { id: carga.sub, email: carga.email, rol: carga.rol };
      return true;
    } catch {
      throw new UnauthorizedException('Token de acceso invalido o expirado');
    }
  }

  private extraerToken(req: Request): string | undefined {
    const cabecera = req.headers.authorization;
    if (cabecera && cabecera.startsWith('Bearer ')) {
      return cabecera.slice(7);
    }
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.access_token;
  }
}
