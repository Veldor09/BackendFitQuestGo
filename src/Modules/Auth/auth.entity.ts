import {Column,CreateDateColumn,Entity,Index,JoinColumn,ManyToOne,PrimaryGeneratedColumn,} from 'typeorm';
import { User } from '../Usuarios/user.entity';

@Entity('auth')
@Index(['usuarioId'])
@Index(['familia'])
export class Auth {
  @PrimaryGeneratedColumn()
  idAuth: number;

  @Column()
  usuarioId: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  hashToken: string;

  @Column({ type: 'uuid' })
  familia: string;

  @Column({ type: 'timestamptz' })
  expiraEn: Date;

  @Column({ type: 'boolean', default: false })
  revocado: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  agenteUsuario: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @ManyToOne(() => User, (user) => user.sesiones, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;
}
