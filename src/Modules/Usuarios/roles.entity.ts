import {Column,Entity,OneToMany,PrimaryGeneratedColumn,} from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  idrol: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombreRol: string;

  @OneToMany(() => User, (user) => user.rol)
  usuarios: User[];
}
