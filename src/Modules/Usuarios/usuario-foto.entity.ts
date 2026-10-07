import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Foto de perfil de una cuenta (una por usuario). Va en la base de datos, no
 * en disco, por la misma razon que `nodo_fotos`: el disco del servidor se
 * pierde en cada despliegue. Vive en su propia tabla para que listar usuarios
 * no arrastre los bytes.
 */
@Entity('usuario_fotos')
export class UsuarioFoto {
  @PrimaryColumn({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_usuario_fotos_usuario',
  })
  usuario: User;

  @Column({ type: 'bytea' })
  contenido: Buffer;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 30 })
  tipoMime: string;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamptz' })
  actualizadoEn: Date;
}
