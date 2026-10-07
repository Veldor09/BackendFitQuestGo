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
import { CategoriaEvento } from './categoria-evento.enum';

export interface PuntoGeo {
  lat: number;
  lng: number;
}

/**
 * Un trazo dibujado por la empresa: un area (poligono cerrado, sin repetir el
 * primer punto al final) o un recorrido (linea). Sin PostGIS, igual que
 * `Ruta.puntos`: la lista ordenada de puntos vive dentro del evento.
 */
export interface ZonaEvento {
  nombre: string;
  puntos: PuntoGeo[];
}

@Entity('eventos')
export class Evento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 30 })
  categoria: CategoriaEvento;

  @Column({ type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ type: 'timestamptz' })
  fechaFin: Date;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  areas: ZonaEvento[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recorridos: ZonaEvento[];

  @SoloAutorPublico()
  @ManyToOne(() => User, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creado_por' })
  creadoPor: User;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;
}
