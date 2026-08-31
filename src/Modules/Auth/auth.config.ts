import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthConfig {
  constructor(private readonly config: ConfigService) {}

  get secretoAccessToken(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  get duracionAccessToken(): number {
    return Number(this.config.get<string>('JWT_ACCESS_TTL', '900'));
  }

  get duracionRefreshDias(): number {
    return Number(this.config.get<string>('REFRESH_TTL_DIAS', '7'));
  }

  get cookieSegura(): boolean {
    return this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
  }
}
