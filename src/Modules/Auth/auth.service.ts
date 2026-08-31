import {Injectable,UnauthorizedException,} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { UserService } from '../Usuarios/user.service';
import { RoleId } from '../Usuarios/roles.enum';
import { ContrasenasServicio } from './services/contrasenas.service';
import { TokensServicio } from './services/tokens.service';
import { RegistroDto } from './dto/registro.dto';
import { InicioSesionDto } from './dto/inicio-sesion.dto';

interface DatosCliente {
  agenteUsuario?: string | null;
  ip?: string | null;
}

export interface ResumenUsuario {
  id: number;
  nombre: string;
  email: string;
  rol: number;
}

export interface ResultadoAuth {
  accessToken: string;
  refreshToken: string;
  refreshExpiraEn: Date;
  usuario: ResumenUsuario;
}

const HASH_FALSO =
  '$2b$12$GOaQIwl0Koy33EDKB3xzLuo7yhQdhaXF3PATrMnHFpvFYI8LljMBa';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    private readonly userService: UserService,
    private readonly contrasenas: ContrasenasServicio,
    private readonly tokens: TokensServicio,
  ) {}

  async registrar(
    dto: RegistroDto,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    const hash = await this.contrasenas.hashear(dto.contrasena);
    const usuario = await this.userService.createUser({
      nombreUser: dto.nombre,
      emailUser: dto.email,
      passwordUserHash: hash,
      idrol: RoleId.UserNormal,
    });
    return this.emitirSesion(usuario, datos);
  }

  async iniciarSesion(
    dto: InicioSesionDto,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    const usuario = await this.usuarios.findOne({
      where: { emailUser: dto.email },
    });
    const valido = await this.contrasenas.verificar(
      dto.contrasena,
      usuario?.passwordUserHash ?? HASH_FALSO,
    );
    if (!usuario || !valido) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    return this.emitirSesion(usuario, datos);
  }

  async renovar(
    refreshTokenPlano: string,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    const { usuarioId, refresh } = await this.tokens.rotarRefreshToken(
      refreshTokenPlano,
      datos,
    );
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const accessToken = await this.tokens.firmarAccessToken({
      sub: usuario.id,
      email: usuario.emailUser,
      rol: usuario.idrol,
    });
    return {
      accessToken,
      refreshToken: refresh.tokenPlano,
      refreshExpiraEn: refresh.expiraEn,
      usuario: this.resumen(usuario),
    };
  }

  async cerrarSesion(refreshTokenPlano: string | undefined): Promise<void> {
    if (refreshTokenPlano) {
      await this.tokens.revocarPorToken(refreshTokenPlano);
    }
  }

  cerrarTodo(usuarioId: number): Promise<void> {
    return this.tokens.revocarTodasDelUsuario(usuarioId);
  }

  private async emitirSesion(
    usuario: User,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    const accessToken = await this.tokens.firmarAccessToken({
      sub: usuario.id,
      email: usuario.emailUser,
      rol: usuario.idrol,
    });
    const refresh = await this.tokens.emitirRefreshToken(usuario.id, datos);
    return {
      accessToken,
      refreshToken: refresh.tokenPlano,
      refreshExpiraEn: refresh.expiraEn,
      usuario: this.resumen(usuario),
    };
  }

  private resumen(usuario: User): ResumenUsuario {
    return {
      id: usuario.id,
      nombre: usuario.nombreUser,
      email: usuario.emailUser,
      rol: usuario.idrol,
    };
  }
}
