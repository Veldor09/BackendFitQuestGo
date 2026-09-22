import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ContrasenasServicio } from '../Auth/services/contrasenas.service';
import { CreateUserDto, UpdateUserDto } from './dto/UserDTO';
import { EstadoUsuario } from './estado.enum';
import { Role } from './roles.entity';
import { User } from './user.entity';

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
}
