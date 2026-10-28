import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { TipoCalificable, ValorCalificacion } from './calificacion.enum';

@Entity('calificaciones')
@Unique('UQ_calificaciones_objeto_usuario', [
  'tipo',
  'objetoId',
  'clave',
  'usuarioId',
])
@Index('IDX_calificaciones_objeto', ['tipo', 'objetoId'])
export class Calificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  tipo: TipoCalificable;

  @Column({ name: 'objeto_id', type: 'int' })
  objetoId: number;

  @Column({ type: 'varchar', length: 32, default: '' })
  clave: string;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_calificaciones_usuario',
  })
  usuario: User;

  @Column({ type: 'varchar', length: 10 })
  valor: ValorCalificacion;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
