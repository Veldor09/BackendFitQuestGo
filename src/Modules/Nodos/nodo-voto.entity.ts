import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { TipoVotoNodo } from './estado-nodo.enum';
import { Nodo } from './nodo.entity';

/**
 * Voto de una persona sobre un punto de interes: confirma que sigue ahi o lo
 * marca como obsoleto. La restriccion unica impone un voto por persona.
 */
@Entity('nodo_votos')
@Unique('UQ_nodo_votos_nodo_usuario', ['nodoId', 'usuarioId'])
export class NodoVoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nodo_id', type: 'int' })
  nodoId: number;

  @ManyToOne(() => Nodo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'nodo_id',
    foreignKeyConstraintName: 'FK_nodo_votos_nodo',
  })
  nodo: Nodo;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_nodo_votos_usuario',
  })
  usuario: User;

  @Column({ type: 'varchar', length: 10 })
  tipo: TipoVotoNodo;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
