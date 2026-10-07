import { Exclude } from 'class-transformer';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auth } from '../Auth/auth.entity';
import { EstadoUsuario } from './estado.enum';
import { Role } from './roles.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombreUser: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  emailUser: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  passwordUserHash: string;

  @Column()
  idrol: number;

  @Column({ type: 'varchar', length: 20, default: EstadoUsuario.Activado })
  estado: EstadoUsuario;

  @Column({ type: 'timestamptz', nullable: true })
  terminosAceptadosEn: Date | null;

  @Column({ type: 'text', array: true, default: '{}' })
  intereses: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  actividades: string[];

  @Column({ type: 'varchar', length: 3, default: 'km' })
  unidad: string;

  @Column({ type: 'boolean', default: true })
  notificaciones: boolean;

  @Column({ type: 'varchar', length: 10, default: 'publico' })
  visibilidad: string;

  // Contacto de la cuenta Empresa. Los deportistas no lo usan (queda NULL).
  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @ManyToOne(() => Role, (role) => role.usuarios, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'idrol' })
  rol: Role;

  @OneToMany(() => Auth, (auth) => auth.usuario)
  sesiones: Auth[];
}
