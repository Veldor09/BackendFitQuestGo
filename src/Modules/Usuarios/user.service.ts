import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ContrasenasServicio } from '../Auth/services/contrasenas.service';
import { CreateUserDto, UpdateUserDto } from './dto/UserDTO';
import { EstadoUsuario } from './estado.enum';
import { Role } from './roles.entity';
import { ActualizarPerfilEmpresaDto } from '../Auth/dto/actualizar-perfil-empresa.dto';
import {
  detectarTipoImagen,
  MAX_FOTO_BYTES,
} from '../Nodos/imagen.util';
import { RoleId } from './roles.enum';
import { User } from './user.entity';
import { UsuarioFoto } from './usuario-foto.entity';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly contrasenas: ContrasenasServicio,
    @InjectRepository(UsuarioFoto)
    private readonly fotoRepository: Repository<UsuarioFoto>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.find({ order: { id: 'ASC' } });
  }

  async findOneUser(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }

    return user;
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    // `passwordUserHash` llega en texto plano desde el DTO; aqui se hashea.
    user.passwordUserHash = await this.contrasenas.hashear(
      dto.passwordUserHash,
    );
    user.rol = await this.getRole(dto.idrol);
    return this.save(user);
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOneUser(id);
    const { passwordUserHash, ...resto } = dto;
    this.userRepository.merge(user, resto);
    if (passwordUserHash !== undefined && passwordUserHash !== '') {
      user.passwordUserHash = await this.contrasenas.hashear(passwordUserHash);
    }
    if (dto.idrol !== undefined) {
      user.rol = await this.getRole(dto.idrol);
    }
    return this.save(user);
  }

  /**
   * Una cuenta Empresa cambia su nombre comercial y su telefono. Lo que no
   * llega queda como estaba; un telefono vacio lo borra.
   */
  async actualizarPerfilEmpresa(
    id: number,
    dto: ActualizarPerfilEmpresaDto,
  ): Promise<User> {
    const user = await this.findOneUser(id);
    if (user.idrol !== Number(RoleId.Empresa)) {
      throw new ForbiddenException('Solo una cuenta de empresa puede hacer esto');
    }
    if (dto.nombreComercial !== undefined) {
      user.nombreUser = dto.nombreComercial.trim();
    }
    if (dto.telefono !== undefined) {
      user.telefono = dto.telefono.trim() || null;
    }
    return this.save(user);
  }

  /** Guarda (o reemplaza) la foto de perfil. Solo JPEG, PNG o WebP de hasta 3 MB. */
  async guardarFoto(id: number, datos: Buffer): Promise<void> {
    await this.findOneUser(id);
    if (datos.length > MAX_FOTO_BYTES) {
      throw new PayloadTooLargeException(
        `La foto pesa mas de ${MAX_FOTO_BYTES / (1024 * 1024)} MB`,
      );
    }
    // Se confia en los bytes, no en lo que declare el archivo.
    const tipoMime = detectarTipoImagen(datos);
    if (!tipoMime) {
      throw new BadRequestException('La foto debe ser JPEG, PNG o WebP');
    }
    await this.fotoRepository.save({ usuarioId: id, contenido: datos, tipoMime });
  }

  async obtenerFoto(
    id: number,
  ): Promise<{ contenido: Buffer; tipoMime: string }> {
    const foto = await this.fotoRepository.findOne({ where: { usuarioId: id } });
    if (!foto) {
      throw new NotFoundException('La cuenta no tiene foto de perfil');
    }
    return { contenido: foto.contenido, tipoMime: foto.tipoMime };
  }

  async quitarFoto(id: number): Promise<void> {
    await this.fotoRepository.delete({ usuarioId: id });
  }

  /**
   * Baja / alta logica. No borra la fila: solo cambia el `estado`. Un usuario
   * Desactivado no puede iniciar sesion ni renovar su token.
   */
  async cambiarEstado(id: number, estado: EstadoUsuario): Promise<User> {
    const user = await this.findOneUser(id);
    user.estado = estado;
    return this.userRepository.save(user);
  }

  private async getRole(idrol: number): Promise<Role> {
    const rol = await this.roleRepository.findOneBy({ idrol });
    if (!rol) {
      throw new NotFoundException(`Rol ${idrol} no encontrado`);
    }
    return rol;
  }

  private async save(user: User): Promise<User> {
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error as QueryFailedError & { code?: string }).code;
        if (code === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            `El email ${user.emailUser} ya esta registrado`,
          );
        }
        if (code === PG_FOREIGN_KEY_VIOLATION) {
          throw new NotFoundException(`Rol ${user.idrol} no encontrado`);
        }
      }
      throw error;
    }
  }
  async estadisticas(id: number): Promise<{ kmRecorridos: number; rutasCompletadas: number; insignias: number }> {
    await this.findOneUser(id);
    const result: any[] = await this.userRepository.manager.query(
      'SELECT COALESCE(SUM(CAST(r."distancia_km" AS float)), 0) AS km, COUNT(r.id)::int AS rutas FROM rutas r WHERE r.creado_por = $1 AND r.estado != $2',
      [id, 'Rechazada'],
    );
    const km = parseFloat(result[0]?.km ?? '0');
    const rutas = parseInt(result[0]?.rutas ?? '0', 10);
    let insignias = 0;
    if (rutas >= 1) insignias++;
    if (rutas >= 5) insignias++;
    if (rutas >= 10) insignias++;
    if (km >= 100) insignias++;
    if (km >= 500) insignias++;
    return { kmRecorridos: Math.round(km * 10) / 10, rutasCompletadas: rutas, insignias };
  }

}
