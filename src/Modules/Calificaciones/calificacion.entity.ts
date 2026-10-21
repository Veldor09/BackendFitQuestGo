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

/**
 * Pulgar arriba o abajo de una persona sobre una ruta, un nodo, un evento o un
 * area de un evento. La restriccion unica impone una calificacion por persona
 * y objeto (cambiarla es actualizar la fila).
 *
 * `clave` solo se usa con las areas de un evento: como viven dentro del evento
 * y no tienen id propio, se identifican por una huella de su trazo. Si la
 * empresa redibuja el area, la huella cambia y la calificacion vieja deja de
 * contar. Para el resto de objetos va vacia.
 */
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
