/** Monedas en las que se cobra el patrocinio. Cada una tiene su propio precio configurado: no hay conversion. */
export type CodigoMoneda = 'CRC' | 'USD' | 'EUR';

export interface Moneda {
  codigo: CodigoMoneda;
  simbolo: string;
  /** Decimales con los que se MUESTRA el importe (la unidad minima de cada pasarela es otra cosa). */
  decimales: number;
}

/** Misma lista, en el mismo orden, que `lib/core/catalogos/monedas.dart` de la app: es un contrato. */
export const MONEDAS: readonly Moneda[] = [
  { codigo: 'CRC', simbolo: '₡', decimales: 0 },
  { codigo: 'USD', simbolo: 'US$', decimales: 2 },
  { codigo: 'EUR', simbolo: '€', decimales: 2 },
];

/** Paises de la zona euro (codigo ISO de dos letras; Bulgaria desde 2026). */
export const PAISES_ZONA_EURO: readonly string[] = [
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
];

/**
 * Costa Rica paga en colones, la zona euro en euros y el resto del mundo (y
 * cualquier pais vacio o desconocido) en dolares.
 */
export function monedaParaPais(pais?: string | null): CodigoMoneda {
  const codigo = (pais ?? '').trim().toUpperCase();
  if (codigo === 'CR') return 'CRC';
  if (PAISES_ZONA_EURO.includes(codigo)) return 'EUR';
  return 'USD';
}
