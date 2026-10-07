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
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from './notificacion.enum';

@Entity('notificacion')
@Index('IDX_notificacion_usuario_leida_creada', ['idUsuario', 'leida', 'creadaEn'])
export class Notificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario' })
  idUsuario: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;

  @Column({ type: 'varchar', length: 50 })
  categoria: CategoriaNotificacion;

  @Column({ type: 'varchar', length: 160 })
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'boolean', default: false })
  leida: boolean;

  @Column({
    name: 'referencia_tipo',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenciaTipo: ReferenciaTipoNotificacion | null;

  @Column({ name: 'referencia_id', type: 'int', nullable: true })
  referenciaId: number | null;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;
}
