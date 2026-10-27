import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../Usuarios/user.entity';

/**
 * Un telefono donde un usuario inicio sesion y acepto recibir avisos fuera de
 * la app. El `token` es el que entrega Firebase Cloud Messaging; si el mismo
 * telefono cambia de cuenta, la fila pasa al usuario nuevo (el token es unico).
 */
@Entity('dispositivos_push')
@Index('UQ_dispositivos_push_token', ['token'], { unique: true })
@Index('IDX_dispositivos_push_usuario', ['usuarioId'])
export class DispositivoPush {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  /** `android` o `ios`. */
  @Column({ type: 'varchar', length: 10 })
  plataforma: string;

  /** Idioma de la app en ese telefono (`es`, `en` o `pt`): el del aviso. */
  @Column({ type: 'varchar', length: 5, default: 'es' })
  idioma: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
