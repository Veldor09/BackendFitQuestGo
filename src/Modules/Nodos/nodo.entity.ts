import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { EstadoNodo } from './estado-nodo.enum';

@Entity('nodos')
export class Nodo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  // Texto libre por ahora (Agua, Restaurante, Taller, Mirador, ...).
  // Candidato a moverse a un catalogo (ADM-11) cuando haga falta.
  @Column({ type: 'varchar', length: 50 })
  categoria: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 20, default: EstadoNodo.Pendiente })
  estado: EstadoNodo;

  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User;

  // `timestamptz` explicito: la columna `timestamp` por defecto no guarda
  // zona horaria, y el driver de pg la reinterpreta segun el TZ del proceso
  // de Node al leerla de vuelta (aqui, UTC-6), desfasando la hora 6h.
  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
