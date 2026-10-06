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
import { Alerta } from './alerta.entity';
import { TipoVotoAlerta } from './estado-alerta.enum';

/**
 * Voto de una persona sobre una alerta. La restriccion unica impone "un voto
 * por persona por alerta": confirmar o desmentir varias veces ya no es posible.
 */
@Entity('alerta_votos')
@Unique('UQ_alerta_votos_alerta_usuario', ['alertaId', 'usuarioId'])
export class AlertaVoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'alerta_id', type: 'int' })
  alertaId: number;

  @ManyToOne(() => Alerta, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'alerta_id',
    foreignKeyConstraintName: 'FK_alerta_votos_alerta',
  })
  alerta: Alerta;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'usuario_id',
    foreignKeyConstraintName: 'FK_alerta_votos_usuario',
  })
  usuario: User;

  @Column({ type: 'varchar', length: 10 })
  tipo: TipoVotoAlerta;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
