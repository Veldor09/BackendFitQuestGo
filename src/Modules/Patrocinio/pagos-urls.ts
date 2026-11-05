import type { Request } from 'express';

/**
 * La direccion publica de este backend, a donde vuelve la persona al terminar de
 * pagar. `PUBLIC_BASE_URL` la fija; sin ella se usa la del propio pedido (en
 * local, la misma por la que la app llega al servidor).
 */
export function urlBasePublica(
  request: Pick<Request, 'protocol' | 'get'>,
): string {
  const configurada = process.env.PUBLIC_BASE_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, '');
  // Detras de un proxy (Render) el protocolo real viene en esta cabecera.
  const reenviado = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocolo = reenviado === 'https' ? 'https' : request.protocol;
  return `${protocolo}://${request.get('host')}`;
}
