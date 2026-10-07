import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { Insignia } from './insignia.entity';

@Entity('usuario_insignia')
@Unique(['idUsuario', 'idInsignia'])
@Index('IDX_usuario_insignia_usuario', ['idUsuario'])
export class UsuarioInsignia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_usuario' })
  idUsuario: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;

  @Column({ name: 'id_insignia' })
  idInsignia: number;

  @ManyToOne(() => Insignia, (insignia) => insignia.usuariosInsignias, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'id_insignia' })
  insignia: Insignia;

  @CreateDateColumn({ name: 'obtenida_en', type: 'timestamptz' })
  obtenidaEn: Date;
}
