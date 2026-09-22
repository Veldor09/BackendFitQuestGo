import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../Usuarios/user.entity';

@Entity('restablecimientos_contrasena')
@Index(['usuarioId'])
export class RestablecimientoContrasena {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuarioId: number;

  @Column({ type: 'varchar', length: 64 })
  hashCodigo: string;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  @Column({ type: 'boolean', default: false })
  usado: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;
}
