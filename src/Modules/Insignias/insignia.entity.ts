
import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TipoInsignia } from './insignia.enum';
import { UsuarioInsignia } from './usuario-insignia.entity';

/**
 * Métricas utilizadas para calcular el progreso
 * y desbloquear automáticamente las insignias.
 */
export enum MetricaInsignia {
  Km = 'km',
  Rutas = 'rutas',
  Alertas = 'alertas',
  Nodos = 'nodos',
  Especial = 'especial',
}

@Entity('insignia')
export class Insignia {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Código único de la insignia.
   * Ejemplos: PRIMERA_RUTA, KM_100, RUTAS_25.
   */
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  codigo: string;

  /**
   * Nombre visible de la insignia.
   */
  @Column({
    type: 'varchar',
    length: 100,
  })
  nombre: string;

  /**
   * Descripción del logro y sus requisitos.
   */
  @Column({
    type: 'text',
  })
  descripcion: string;

  /**
   * Emoji que representa visualmente la insignia.
   */
  @Column({
    type: 'varchar',
    length: 10,
  })
  emoji: string;

  /**
   * Tipo original de insignia.
   * Se conserva para mantener compatibilidad.
   */
  @Column({
    type: 'varchar',
    length: 20,
  })
  tipo: TipoInsignia;

  /**
   * Actividad utilizada para calcular el progreso.
   *
   * km       -> Kilómetros acumulados.
   * rutas    -> Cantidad de rutas registradas.
   * alertas  -> Cantidad de alertas creadas.
   * nodos    -> Cantidad de puntos de interés.
   * especial -> Logros con condiciones específicas.
   *
   * Nullable para permitir la migración gradual
   * de las insignias existentes.
   */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  metrica: MetricaInsignia | null;

  /**
   * Cantidad necesaria para desbloquear la insignia.
   *
   * Ejemplos:
   * 10 kilómetros
   * 25 rutas
   * 50 alertas
   * 100 puntos de interés
   */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  meta: number | null;

  /**
   * Determina si la insignia está disponible.
   *
   * Las insignias inactivas no deben otorgarse
   * automáticamente.
   */
  @Column({
    type: 'boolean',
    default: true,
  })
  activa: boolean;

  /**
   * Relación con los usuarios que han
   * desbloqueado esta insignia.
   */
  @OneToMany(
    () => UsuarioInsignia,
    (usuarioInsignia) => usuarioInsignia.insignia,
  )
  usuariosInsignias: UsuarioInsignia[];
}
