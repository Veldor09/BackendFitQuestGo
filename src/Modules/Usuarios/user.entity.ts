import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auth } from '../Auth/auth.entity';
import { Role } from './roles.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombreUser: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  emailUser: string;

  @Column({ type: 'varchar', length: 255 })
  passwordUserHash: string;

  @Column()
  idrol: number;

  @ManyToOne(() => Role, (role) => role.usuarios, {
    eager: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  // Explicito para que la FK reutilice la columna idrol de arriba
  // y no genere una columna nueva tipo rol_idrol.
  @JoinColumn({ name: 'idrol' })
  rol: Role;

  @OneToMany(() => Auth, (auth) => auth.usuario)
  sesiones: Auth[];
}
