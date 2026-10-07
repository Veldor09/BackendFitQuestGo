import { QueryFailedError } from 'typeorm';

/** Codigo de Postgres para `unique_violation`. */
const PG_VIOLACION_UNICA = '23505';

/** Postgres rechazo una fila por repetir una clave unica (p. ej. un voto doble). */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === PG_VIOLACION_UNICA
  );
}
