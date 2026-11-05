import { timingSafeEqual } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import { SuscripcionesService } from './suscripciones.service';

function pagina(titulo: string, detalle: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#f5f6f3;color:#0e1a2b;text-align:center;padding:24px}h1{font-size:22px;margin:0 0 8px}p{margin:0;color:#5b6573}</style>
</head><body><main><h1>${titulo}</h1><p>${detalle}</p></main></body></html>`;
}

/** Compara en tiempo constante; vacio nunca coincide. */
function coincide(recibido: string | undefined, esperado: string | undefined) {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lo que toca la pasarela de pago, sin sesion de la app: a donde vuelve la
 * persona al pagar y el aviso automatico (webhook) de ONVO. Ninguna de las dos
 * rutas confia en lo que recibe: siempre le pregunta a ONVO si el pago se hizo.
 */
@Controller('patrocinio/pagos')
export class PagosController {
  constructor(private readonly suscripciones: SuscripcionesService) {}

  /** A donde vuelve la persona al pagar. La app cierra su pantalla al llegar aqui. */
  @Get('retorno')
  // Cada visita puede consultar a ONVO: mas estricto que el limite global.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async retorno(@Query('s') s?: string): Promise<string> {
    const id = Number(s);
    if (!s || !Number.isInteger(id) || id <= 0) {
      return pagina('Pago pendiente', 'Vuelve a la app para ver el estado.');
    }

    try {
      const estado = await this.suscripciones.confirmarPago(id);
      if (estado === 'activada' || estado === 'ya_activa') {
        return pagina(
          'Pago recibido',
          'Tu plan ya esta activo. Puedes volver a la app.',
        );
      }
    } catch {
      // La pasarela no respondio: no es un error para la persona, solo falta confirmar.
    }
    return pagina(
      'Pago pendiente',
      'Aun no recibimos la confirmacion. Vuelve a la app: se actualiza sola.',
    );
  }

  @Get('cancelado')
  @Header('Content-Type', 'text/html; charset=utf-8')
  cancelado(): string {
    return pagina(
      'Pago cancelado',
      'No se hizo ningun cobro. Puedes volver a la app.',
    );
  }

  /** ONVO avisa que una sesion de pago se completo. */
  @Post('onvo/webhook')
  @HttpCode(200)
  async webhookOnvo(
    @Headers('x-webhook-secret') secreto: string | undefined,
    @Body() cuerpo: unknown,
  ): Promise<{ recibido: true }> {
    if (!coincide(secreto, process.env.ONVO_WEBHOOK_SECRET)) {
      throw new UnauthorizedException();
    }

    const evento = cuerpo as
      { type?: unknown; data?: { id?: unknown } } | null | undefined;
    if (
      evento &&
      typeof evento === 'object' &&
      evento.type === 'checkout-session.succeeded' &&
      typeof evento.data?.id === 'string'
    ) {
      await this.suscripciones.confirmarPorSesion(evento.data.id);
    }
    return { recibido: true };
  }
}
