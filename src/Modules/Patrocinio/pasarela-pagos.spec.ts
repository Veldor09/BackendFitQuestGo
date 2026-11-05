import { PasarelaOnvo } from './pasarela-pagos';

const DATOS = {
  monto: 2500,
  moneda: 'CRC' as const,
  descripcion: 'Plan Explorador Mensual #813134',
  clienteNombre: 'Ana Mora',
  clienteEmail: 'ana@example.com',
  redirectUrl: 'http://localhost:3001/patrocinio/pagos/retorno?s=7',
  cancelUrl: 'http://localhost:3001/patrocinio/pagos/cancelado',
  metadata: { suscripcionId: '7' },
};

function respuesta(estado: number, cuerpo: unknown): Response {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: () => Promise.resolve(cuerpo),
    text: () => Promise.resolve(JSON.stringify(cuerpo)),
  } as unknown as Response;
}

describe('PasarelaOnvo', () => {
  it('sin ONVO_SECRET_KEY no esta disponible y no crea sesiones', async () => {
    const fetchFalso = jest.fn();
    const pasarela = new PasarelaOnvo({}, fetchFalso);

    expect(pasarela.disponible).toBe(false);
    await expect(pasarela.crearSesion(DATOS)).rejects.toThrow();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('crea el enlace de un solo uso con el monto en unidad minima, tarjeta y SINPE Movil', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(
      respuesta(201, {
        id: 'cs_1',
        url: 'https://checkout.onvopay.com/pay/cs_1',
      }),
    );
    const pasarela = new PasarelaOnvo(
      { ONVO_SECRET_KEY: 'onvo_test_secret_key_x' },
      fetchFalso,
    );

    const sesion = await pasarela.crearSesion(DATOS);

    expect(sesion).toEqual({
      id: 'cs_1',
      url: 'https://checkout.onvopay.com/pay/cs_1',
    });
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.onvopay.com/v1/checkout/sessions/one-time-link',
    );
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer onvo_test_secret_key_x',
    );
    const cuerpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(cuerpo.lineItems).toEqual([
      {
        quantity: 1,
        unitAmount: 250000,
        currency: 'CRC',
        description: 'Plan Explorador Mensual #813134',
      },
    ]);
    expect(cuerpo.paymentMethodTypes).toEqual(['card', 'mobile_number']);
    expect(cuerpo.redirectUrl).toBe(DATOS.redirectUrl);
    expect(cuerpo.cancelUrl).toBe(DATOS.cancelUrl);
    expect(cuerpo.customerEmail).toBe('ana@example.com');
    expect(cuerpo.metadata).toEqual({ suscripcionId: '7' });
  });

  it('obtenerSesion distingue pagada, abierta y expirada', async () => {
    const fetchFalso = jest
      .fn()
      .mockResolvedValueOnce(
        respuesta(200, {
          id: 'cs_1',
          status: 'complete',
          paymentStatus: 'paid',
          metadata: { suscripcionId: '7' },
        }),
      )
      .mockResolvedValueOnce(
        respuesta(200, { id: 'cs_2', status: 'open', paymentStatus: 'unpaid' }),
      )
      .mockResolvedValueOnce(
        respuesta(200, {
          id: 'cs_3',
          status: 'expired',
          paymentStatus: 'unpaid',
        }),
      );
    const pasarela = new PasarelaOnvo({ ONVO_SECRET_KEY: 'k' }, fetchFalso);

    await expect(pasarela.obtenerSesion('cs_1')).resolves.toEqual({
      id: 'cs_1',
      pagada: true,
      expirada: false,
      metadata: { suscripcionId: '7' },
    });
    await expect(pasarela.obtenerSesion('cs_2')).resolves.toMatchObject({
      pagada: false,
      expirada: false,
      metadata: {},
    });
    await expect(pasarela.obtenerSesion('cs_3')).resolves.toMatchObject({
      pagada: false,
      expirada: true,
    });
    expect((fetchFalso.mock.calls as [string][])[0][0]).toBe(
      'https://api.onvopay.com/v1/checkout/sessions/cs_1',
    );
  });

  it('un error de ONVO lanza sin filtrar la llave', async () => {
    const fetchFalso = jest
      .fn()
      .mockResolvedValue(respuesta(401, { message: 'invalid key' }));
    const pasarela = new PasarelaOnvo(
      { ONVO_SECRET_KEY: 'onvo_test_secret_key_secreta' },
      fetchFalso,
    );

    const error = await pasarela.crearSesion(DATOS).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('secreta');
  });
});
