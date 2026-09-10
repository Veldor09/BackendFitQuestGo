import {Injectable,UnauthorizedException,} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import {createHash,randomBytes,randomUUID,} from 'crypto';
import { Auth } from '../auth.entity';
import { AuthConfig } from '../auth.config';
import { CargaJwt } from '../types/carga-jwt';

interface DatosCliente {
  agenteUsuario?: string | null;
  ip?: string | null;
}

export interface RefreshEmitido {
  tokenPlano: string;
  expiraEn: Date;
}

@Injectable()
export class TokensServicio {
  constructor(
    @InjectRepository(Auth) private readonly sesiones: Repository<Auth>,
    private readonly jwt: JwtService,
    private readonly config: AuthConfig,
  ) {}

  firmarAccessToken(carga: CargaJwt): Promise<string> {
    return this.jwt.signAsync(carga, {
      secret: this.config.secretoAccessToken,
      expiresIn: this.config.duracionAccessToken,
    });
  }

  async emitirRefreshToken(
    usuarioId: number,
    datos: DatosCliente,
    familia?: string,
  ): Promise<RefreshEmitido> {
    const tokenPlano = randomBytes(48).toString('base64url');
    const expiraEn = this.calcularExpiracion();
    const sesion = this.sesiones.create({
      usuarioId,
      hashToken: this.hashDe(tokenPlano),
      familia: familia ?? randomUUID(),
      expiraEn,
      revocado: false,
      agenteUsuario: datos.agenteUsuario ?? null,
      ip: datos.ip ?? null,
    });
    await this.sesiones.save(sesion);
    return { tokenPlano, expiraEn };
  }

  async rotarRefreshToken(
    tokenPlano: string,
    datos: DatosCliente,
  ): Promise<{ usuarioId: number; refresh: RefreshEmitido }> {
    const sesion = await this.sesiones.findOne({
      where: { hashToken: this.hashDe(tokenPlano) },
    });

    if (!sesion) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (sesion.revocado) {
      await this.sesiones.update(
        { familia: sesion.familia },
        { revocado: true },
      );
      throw new UnauthorizedException(
        'Refresh token reutilizado; se revoco la sesion completa',
      );
    }

    if (sesion.expiraEn.getTime() < Date.now()) {
      await this.sesiones.update({ idAuth: sesion.idAuth }, { revocado: true });
      throw new UnauthorizedException('Refresh token expirado');
    }

    await this.sesiones.update({ idAuth: sesion.idAuth }, { revocado: true });
    const refresh = await this.emitirRefreshToken(
      sesion.usuarioId,
      datos,
      sesion.familia,
    );
    return { usuarioId: sesion.usuarioId, refresh };
  }

  async revocarPorToken(tokenPlano: string): Promise<void> {
    await this.sesiones.update(
      { hashToken: this.hashDe(tokenPlano) },
      { revocado: true },
    );
  }

  async revocarTodasDelUsuario(usuarioId: number): Promise<void> {
    await this.sesiones.update({ usuarioId }, { revocado: true });
  }

  private hashDe(tokenPlano: string): string {
    return createHash('sha256').update(tokenPlano).digest('hex');
  }

  private calcularExpiracion(): Date {
    const ms = this.config.duracionRefreshDias * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }
}
