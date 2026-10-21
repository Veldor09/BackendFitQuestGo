import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { PuntoRuta, Ruta } from './ruta.entity';

@Entity('recorridos_rutas')
export class RecorridoRuta {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ruta, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @Column({ name: 'ruta_id' })
  rutaId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  distanciaKm: number;

  @Column({ type: 'integer', default: 0 })
  duracionSegundos: number;

  @Column({ type: 'timestamptz' })
  iniciadoEn: Date;

  @Column({ type: 'timestamptz' })
  finalizadoEn: Date;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  puntos: PuntoRuta[];

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
