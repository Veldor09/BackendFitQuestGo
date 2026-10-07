import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomInt } from 'crypto';
import { User } from '../Usuarios/user.entity';
import { UserService } from '../Usuarios/user.service';
import { EstadoUsuario } from '../Usuarios/estado.enum';
import { RoleId } from '../Usuarios/roles.enum';
import { ContrasenasServicio } from './services/contrasenas.service';
import { TokensServicio } from './services/tokens.service';
import { MailService } from './services/mail.service';
import { RestablecimientoContrasena } from './entities/restablecimiento-contrasena.entity';
import { RegistroDto } from './dto/registro.dto';
import { RegistroEmpresaDto } from './dto/registro-empresa.dto';
import { ActualizarPerfilEmpresaDto } from './dto/actualizar-perfil-empresa.dto';
import { InicioSesionDto } from './dto/inicio-sesion.dto';
import { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto';
import { UpdateUserDto } from '../Usuarios/dto/UserDTO';

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

const MINUTOS_EXPIRACION_CODIGO = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly usuarios: Repository<User>,
    @InjectRepository(RestablecimientoContrasena)
    private readonly restablecimientos: Repository<RestablecimientoContrasena>,
    private readonly userService: UserService,
    private readonly contrasenas: ContrasenasServicio,
    private readonly tokens: TokensServicio,
    private readonly mail: MailService,
  ) {}

  async registrar(
    dto: RegistroDto,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    // `createUser` se encarga de hashear la contrasena.
    const usuario = await this.userService.createUser({
      nombreUser: dto.nombre,
      emailUser: dto.email,
      passwordUserHash: dto.contrasena,
      idrol: RoleId.UserNormal,
      terminosAceptadosEn: new Date(),
      intereses: dto.intereses ?? [],
      actividades: dto.actividades ?? [],
    });
    return this.emitirSesion(usuario, datos);
  }

  /** Cuenta Empresa: mismo flujo que `registrar`, pero con rol Empresa. */
  async registrarEmpresa(
    dto: RegistroEmpresaDto,
    datos: DatosCliente,
  ): Promise<ResultadoAuth> {
    const usuario = await this.userService.createUser({
      nombreUser: dto.nombreComercial.trim(),
      emailUser: dto.email,
      passwordUserHash: dto.contrasena,
      idrol: RoleId.Empresa,
      terminosAceptadosEn: new Date(),
      telefono: dto.telefono,
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
    if (usuario.estado === EstadoUsuario.Desactivado) {
      throw new UnauthorizedException(
        'Tu cuenta esta desactivada. Contacta al administrador.',
      );
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
    if (usuario.estado === EstadoUsuario.Desactivado) {
      throw new UnauthorizedException('Tu cuenta esta desactivada.');
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

  obtenerPerfil(usuarioId: number): Promise<User> {
    return this.userService.findOneUser(usuarioId);
  }

  actualizarPerfil(usuarioId: number, dto: UpdateUserDto): Promise<User> {
    return this.userService.updateUser(usuarioId, dto);
  }

  /** Una empresa edita su nombre comercial y su telefono. */
  async actualizarPerfilEmpresa(
    usuarioId: number,
    dto: ActualizarPerfilEmpresaDto,
  ): Promise<ResumenUsuario & { telefono: string | null }> {
    const usuario = await this.userService.actualizarPerfilEmpresa(
      usuarioId,
      dto,
    );
    return { ...this.resumen(usuario), telefono: usuario.telefono };
  }

  guardarFoto(usuarioId: number, datos: Buffer): Promise<void> {
    return this.userService.guardarFoto(usuarioId, datos);
  }

  obtenerFoto(
    usuarioId: number,
  ): Promise<{ contenido: Buffer; tipoMime: string }> {
    return this.userService.obtenerFoto(usuarioId);
  }

  quitarFoto(usuarioId: number): Promise<void> {
    return this.userService.quitarFoto(usuarioId);
  }

  async cerrarSesion(refreshTokenPlano: string | undefined): Promise<void> {
    if (refreshTokenPlano) {
      await this.tokens.revocarPorToken(refreshTokenPlano);
    }
  }

  cerrarTodo(usuarioId: number): Promise<void> {
    return this.tokens.revocarTodasDelUsuario(usuarioId);
  }

  async olvideContrasena(email: string): Promise<void> {
    const usuario = await this.usuarios.findOne({
      where: { emailUser: email },
    });
    if (!usuario) return; // no revelar si el correo existe

    await this.restablecimientos.update(
      { usuarioId: usuario.id, usado: false },
      { usado: true },
    );

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const registro = this.restablecimientos.create({
      usuarioId: usuario.id,
      hashCodigo: this.hashCodigo(codigo),
      expiraEn: new Date(Date.now() + MINUTOS_EXPIRACION_CODIGO * 60_000),
      usado: false,
    });
    await this.restablecimientos.save(registro);
    this.mail
      .enviarCodigoRecuperacion(usuario.emailUser, codigo)
      .catch((error: Error) => {
        // El envio de correo es best-effort: si falla, no debe filtrarse al
        // llamador (revelaria que el usuario existe) ni bloquear la respuesta),
        // pero SI debe quedar visible en los logs del servidor.
        this.logger.error(
          `No se pudo enviar el codigo de recuperacion a un usuario: ${error.message}`,
          error.stack,
        );
      });
  }

  async restablecerContrasena(dto: RestablecerContrasenaDto): Promise<void> {
    const usuario = await this.usuarios.findOne({
      where: { emailUser: dto.email },
    });
    if (!usuario) {
      throw new UnauthorizedException('Codigo invalido o expirado');
    }

    const registro = await this.restablecimientos.findOne({
      where: {
        usuarioId: usuario.id,
        hashCodigo: this.hashCodigo(dto.codigo),
        usado: false,
      },
    });
    if (!registro || registro.expiraEn.getTime() < Date.now()) {
      throw new UnauthorizedException('Codigo invalido o expirado');
    }

    const nuevoHash = await this.contrasenas.hashear(dto.nuevaContrasena);
    await this.usuarios.update(
      { id: usuario.id },
      { passwordUserHash: nuevoHash },
    );
    await this.restablecimientos.update({ id: registro.id }, { usado: true });
    await this.tokens.revocarTodasDelUsuario(usuario.id);
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

  private hashCodigo(codigo: string): string {
    return createHash('sha256').update(codigo).digest('hex');
  }
}
