import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SoloAutorPublico } from '../../common/autor-publico';
import { User } from '../Usuarios/user.entity';
import { ActividadRuta } from './actividad-ruta.enum';
import { EstadoRuta } from './estado-ruta.enum';

export interface PuntoRuta {
  lat: number;
  lng: number;
}

@Entity('rutas')
export class Ruta {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  // Una o varias claves de la lista cerrada `ActividadRuta` (running,
  // ciclismo, ...). Arreglo nativo de Postgres: `text[]`.
  @Column({ type: 'text', array: true })
  actividades: ActividadRuta[];

  @Column({ type: 'varchar', length: 20, default: 'moderada' })
  dificultad: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  distanciaKm: number;

  // Trazo simplificado: lista ordenada de puntos. Sin PostGIS por ahora.
  @Column({ type: 'jsonb' })
  puntos: PuntoRuta[];

  @Column({ type: 'varchar', length: 20, default: EstadoRuta.Privada })
  estado: EstadoRuta;

  @Column({ type: 'varchar', length: 20, default: 'privada' })
  visibilidad: string;

  @SoloAutorPublico()
  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User;

  // `timestamptz` explicito: ver nota en Nodo.creadoEn sobre por que el tipo
  // `timestamp` por defecto desfasa la hora al leerla de vuelta.
  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
