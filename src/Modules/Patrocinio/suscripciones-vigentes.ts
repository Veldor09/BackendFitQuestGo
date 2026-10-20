import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Una suscripcion que vence (o acaba de vencer) y de quien es. */
export interface SuscripcionPorVencer {
  suscripcionId: number;
  usuarioId: number;
  venceEn: Date;
}

/**
 * Lo unico que este modulo necesita saber de las suscripciones de ADM-09A:
 * quien tiene una vigente ahora y cuales vencen en una ventana. Es el unico
 * punto que conoce la tabla, asi un cambio de nombres solo toca la clase SQL.
 */
export interface SuscripcionesVigentes {
  /** De estos usuarios, los que tienen una suscripcion `Activa` y dentro de fechas en `ahora`. */
  conVigencia(usuarioIds: number[], ahora?: Date): Promise<Set<number>>;

  /** Suscripciones `Activa` o `Vencida` cuyo vencimiento cae en (desde, hasta]. */
  vencenEntre(desde: Date, hasta: Date): Promise<SuscripcionPorVencer[]>;
}

export const SUSCRIPCIONES_VIGENTES = Symbol('SUSCRIPCIONES_VIGENTES');

/** Codigo de Postgres para `undefined_table`. */
const PG_TABLA_INEXISTENTE = '42P01';

function esTablaInexistente(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { driverError?: { code?: string } }).driverError?.code ===
      PG_TABLA_INEXISTENTE
  );
}

@Injectable()
export class SuscripcionesVigentesSql implements SuscripcionesVigentes {
  private readonly logger = new Logger(SuscripcionesVigentesSql.name);
  private avisoTablaFaltante = false;

  constructor(private readonly dataSource: DataSource) {}

  async conVigencia(
    usuarioIds: number[],
    ahora: Date = new Date(),
  ): Promise<Set<number>> {
    if (usuarioIds.length === 0) return new Set<number>();
    const filas = await this.consultar<{ usuario_id: number }>(
      `SELECT DISTINCT usuario_id FROM suscripciones
        WHERE usuario_id = ANY($1) AND estado = 'Activa'
          AND inicia_en <= $2 AND vence_en > $2`,
      [usuarioIds, ahora],
    );
    return new Set(filas.map((fila) => Number(fila.usuario_id)));
  }

  async vencenEntre(desde: Date, hasta: Date): Promise<SuscripcionPorVencer[]> {
    const filas = await this.consultar<{
      suscripcion_id: number;
      usuario_id: number;
      vence_en: Date;
    }>(
      `SELECT id AS suscripcion_id, usuario_id, vence_en FROM suscripciones
        WHERE estado IN ('Activa', 'Vencida')
          AND vence_en > $1 AND vence_en <= $2
        ORDER BY vence_en`,
      [desde, hasta],
    );
    return filas.map((fila) => ({
      suscripcionId: Number(fila.suscripcion_id),
      usuarioId: Number(fila.usuario_id),
      venceEn: fila.vence_en,
    }));
  }

  /**
   * Mientras ADM-09A no este desplegada la tabla no existe: en ese caso nadie
   * tiene plan (y nada sale destacado) en lugar de tumbar cada lectura del
   * mapa. Cualquier otro error de la base si se propaga.
   */
  private async consultar<T>(sql: string, parametros: unknown[]): Promise<T[]> {
    try {
      return await this.dataSource.query(sql, parametros);
    } catch (error) {
      if (!esTablaInexistente(error)) throw error;
      if (!this.avisoTablaFaltante) {
        this.avisoTablaFaltante = true;
        this.logger.warn(
          'La tabla `suscripciones` no existe todavia (ADM-09A sin desplegar): nadie figura con plan vigente',
        );
      }
      return [];
    }
  }
}
