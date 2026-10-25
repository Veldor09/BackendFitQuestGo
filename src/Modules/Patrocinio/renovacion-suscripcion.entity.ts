
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { Suscripcion } from './suscripcion.entity';

@Entity('renovaciones_suscripcion')
export class RenovacionSuscripcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'suscripcion_id', type: 'int' })
  suscripcionId: number;

  @ManyToOne(() => Suscripcion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'suscripcion_id' })
  suscripcion: Suscripcion;

  @Column({ name: 'administrador_id', type: 'int' })
  administradorId: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'administrador_id' })
  administrador: User;

  @Column({
    name: 'precio_aplicado',
    type: 'numeric',
    precision: 12,
    scale: 2,
  })
  precioAplicado: string;

  @Column({ type: 'varchar', length: 3 })
  moneda: string;

  @Column({
    name: 'periodo_desde',
    type: 'timestamptz',
  })
  periodoDesde: Date;

  @Column({
    name: 'periodo_hasta',
    type: 'timestamptz',
  })
  periodoHasta: Date;

  @CreateDateColumn({
    name: 'creado_en',
    type: 'timestamptz',
  })
  creadoEn: Date;
}
