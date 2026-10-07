import { ErrorProveedorClima, OpenMeteoCliente } from './open-meteo.cliente';

const respuesta = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Lo que devuelve Open-Meteo para `forecast_hours=4`. */
const cuerpoOk = () => ({
  latitude: 9.93,
  longitude: -84.09,
  hourly: {
    time: [
      '2026-10-06T00:00',
      '2026-10-06T01:00',
      '2026-10-06T02:00',
      '2026-10-06T03:00',
    ],
    precipitation: [0, 8.4, 0.2, 31],
    apparent_temperature: [19.5, 19.9, 36.2, 20.1],
    weather_code: [3, 65, 1, 95],
  },
});

describe('OpenMeteoCliente', () => {
  let cliente: OpenMeteoCliente;
  let pedir: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    delete process.env.CLIMA_API_URL;
    cliente = new OpenMeteoCliente();
    pedir = jest.spyOn(globalThis, 'fetch');
  });

  /** La URL de la primera llamada a `fetch` (el cliente siempre pasa un URL). */
  const urlPedida = (): URL => {
    const entrada = pedir.mock.calls[0][0];
    expect(entrada).toBeInstanceOf(URL);
    return entrada as URL;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLIMA_API_URL;
  });

  it('pide las proximas 4 horas de la zona, con lluvia, sensacion y codigo', async () => {
    pedir.mockResolvedValue(respuesta(cuerpoOk()));

    await cliente.pronostico(9.93, -84.09);

    expect(pedir).toHaveBeenCalledTimes(1);
    const url = urlPedida();
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://api.open-meteo.com/v1/forecast',
    );
    expect(url.searchParams.get('latitude')).toBe('9.93');
    expect(url.searchParams.get('longitude')).toBe('-84.09');
    expect(url.searchParams.get('hourly')).toBe(
      'precipitation,apparent_temperature,weather_code',
    );
    expect(url.searchParams.get('forecast_hours')).toBe('4');
  });

  it('convierte la respuesta en una hora de pronostico por entrada', async () => {
    pedir.mockResolvedValue(respuesta(cuerpoOk()));

    const horas = await cliente.pronostico(9.93, -84.09);

    expect(horas).toEqual([
      { precipitacionMmH: 0, sensacionC: 19.5, codigoWmo: 3 },
      { precipitacionMmH: 8.4, sensacionC: 19.9, codigoWmo: 65 },
      { precipitacionMmH: 0.2, sensacionC: 36.2, codigoWmo: 1 },
      { precipitacionMmH: 31, sensacionC: 20.1, codigoWmo: 95 },
    ]);
  });

  it('un dato que falta (null) o que no es numero queda como null', async () => {
    const cuerpo = cuerpoOk();
    cuerpo.hourly.precipitation = [null, 8.4, 'x', 31] as never;
    cuerpo.hourly.weather_code = [3, null, 1, 95] as never;
    pedir.mockResolvedValue(respuesta(cuerpo));

    const horas = await cliente.pronostico(9.93, -84.09);

    expect(horas[0].precipitacionMmH).toBeNull();
    expect(horas[1].codigoWmo).toBeNull();
    expect(horas[2].precipitacionMmH).toBeNull();
    expect(horas[3].precipitacionMmH).toBe(31);
  });

  it('usa CLIMA_API_URL si esta definida (otro proveedor o un simulador)', async () => {
    process.env.CLIMA_API_URL = 'http://localhost:9999/pronostico';
    pedir.mockResolvedValue(respuesta(cuerpoOk()));

    await cliente.pronostico(9.93, -84.09);

    const url = urlPedida();
    expect(`${url.origin}${url.pathname}`).toBe(
      'http://localhost:9999/pronostico',
    );
    expect(url.searchParams.get('latitude')).toBe('9.93');
  });

  it('corta la espera: la llamada lleva un limite de tiempo', async () => {
    pedir.mockResolvedValue(respuesta(cuerpoOk()));

    await cliente.pronostico(9.93, -84.09);

    const opciones = pedir.mock.calls[0][1];
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
  });

  it('falla con ErrorProveedorClima si el proveedor responde un error', async () => {
    pedir.mockResolvedValue(respuesta({ reason: 'caido' }, 503));
    await expect(cliente.pronostico(9.93, -84.09)).rejects.toBeInstanceOf(
      ErrorProveedorClima,
    );
  });

  it('falla si la respuesta no trae el pronostico por horas', async () => {
    pedir.mockResolvedValue(respuesta({ latitude: 9.93 }));
    await expect(cliente.pronostico(9.93, -84.09)).rejects.toBeInstanceOf(
      ErrorProveedorClima,
    );
  });

  it('falla si el pronostico viene vacio', async () => {
    pedir.mockResolvedValue(
      respuesta({
        hourly: {
          time: [],
          precipitation: [],
          apparent_temperature: [],
          weather_code: [],
        },
      }),
    );
    await expect(cliente.pronostico(9.93, -84.09)).rejects.toBeInstanceOf(
      ErrorProveedorClima,
    );
  });

  it('falla si el cuerpo no es JSON', async () => {
    pedir.mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(cliente.pronostico(9.93, -84.09)).rejects.toBeInstanceOf(
      ErrorProveedorClima,
    );
  });

  it('falla con ErrorProveedorClima si la red se cae o se agota el tiempo', async () => {
    pedir.mockRejectedValue(new TypeError('fetch failed'));
    await expect(cliente.pronostico(9.93, -84.09)).rejects.toBeInstanceOf(
      ErrorProveedorClima,
    );
  });
});
