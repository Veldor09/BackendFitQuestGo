import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';

@Entity('auth')
@Index(['usuarioId'])
export class Auth {
  @PrimaryGeneratedColumn()
  idAuth: number;

  @Column()
  usuarioId: number;

  // Nunca se guarda el token en claro, solo su hash.
  @Column({ type: 'varchar', length: 255, unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.sesiones, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  // Explicito para que la FK reutilice la columna usuario_id de arriba.
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;
}
