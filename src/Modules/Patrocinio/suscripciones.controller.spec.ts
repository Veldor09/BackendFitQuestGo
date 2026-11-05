import type { RequestAutenticado } from '../Auth/types/request-autenticado';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesService } from './suscripciones.service';

describe('SuscripcionesController - consulta de planes', () => {
  let controlador: SuscripcionesController;
  let suscripcionesService: {
    consultarPlanes: jest.Mock;
  };

  beforeEach(() => {
    suscripcionesService = {
      consultarPlanes: jest.fn().mockResolvedValue({
        pais: 'CR',
        moneda: 'CRC',
        planes: [
          {
            id: 1,
            nombre: 'Patrocinio mensual',
            duracionDias: 30,
            moneda: 'CRC',
            importe: '10000.00',
          },
        ],
      }),
    };

    controlador = new SuscripcionesController(
      suscripcionesService as unknown as SuscripcionesService,
    );
  });

  it('consulta los planes utilizando el país recibido', async () => {
    const resultado = await controlador.consultarPlanes('CR');

    expect(suscripcionesService.consultarPlanes).toHaveBeenCalledWith(
      'CR',
      undefined,
    );
    expect(resultado.moneda).toBe('CRC');
    expect(resultado.planes).toHaveLength(1);
  });

  it('permite consultar planes sin indicar país', async () => {
    await controlador.consultarPlanes();

    expect(suscripcionesService.consultarPlanes).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('pide solo los planes que le tocan al tipo de cuenta de quien pregunta', async () => {
    const comoUsuario = {
      usuario: { id: 1, email: 'u@x.co', rol: 1 },
    } as RequestAutenticado;
    const comoEmpresa = {
      usuario: { id: 2, email: 'e@x.co', rol: 2 },
    } as RequestAutenticado;

    await controlador.consultarPlanes('CR', comoUsuario);
    await controlador.consultarPlanes('CR', comoEmpresa);

    expect(suscripcionesService.consultarPlanes).toHaveBeenNthCalledWith(
      1,
      'CR',
      'usuario',
    );
    expect(suscripcionesService.consultarPlanes).toHaveBeenNthCalledWith(
      2,
      'CR',
      'empresa',
    );
  });

  it('devuelve la respuesta generada por el servicio', async () => {
    const respuesta = {
      pais: 'US',
      moneda: 'USD',
      planes: [
        {
          id: 1,
          nombre: 'Patrocinio mensual',
          duracionDias: 30,
          moneda: 'USD',
          importe: '20.00',
        },
      ],
    };

    suscripcionesService.consultarPlanes.mockResolvedValue(respuesta);

    const resultado = await controlador.consultarPlanes('US');

    expect(resultado).toEqual(respuesta);
  });

  it('propaga los errores del servicio', async () => {
    suscripcionesService.consultarPlanes.mockRejectedValue(
      new Error('Error al consultar los planes'),
    );

    await expect(controlador.consultarPlanes('CR')).rejects.toThrow(
      'Error al consultar los planes',
    );
  });
});

describe('SuscripcionesController - pago de la suscripcion', () => {
  let controlador: SuscripcionesController;

  let suscripcionesService: {
    iniciarPago: jest.Mock;
  };

  const request = {
    usuario: {
      id: 10,
      email: 'usuario@ejemplo.com',
      rol: 1,
    },
    protocol: 'http',
    get: (cabecera: string) =>
      cabecera === 'host' ? 'api.test:3001' : undefined,
  } as unknown as RequestAutenticado;

  const dto = {
    planId: 1,
    pais: 'CR',
  };

  const respuesta = {
    suscripcionId: 25,
    numeroSolicitud: '482913',
    url: 'https://checkout.onvopay.com/pay/cs_1',
  };

  beforeEach(() => {
    delete process.env.PUBLIC_BASE_URL;
    suscripcionesService = {
      iniciarPago: jest.fn().mockResolvedValue(respuesta),
    };

    controlador = new SuscripcionesController(
      suscripcionesService as unknown as SuscripcionesService,
    );
  });

  afterEach(() => {
    delete process.env.PUBLIC_BASE_URL;
  });

  it('utiliza el identificador y el rol del usuario autenticado', async () => {
    await controlador.pagar(request, dto);

    expect(suscripcionesService.iniciarPago).toHaveBeenCalledWith(
      10,
      dto,
      1,
      expect.anything(),
    );
  });

  it('no utiliza un identificador de usuario proporcionado en el cuerpo', async () => {
    const datos = { planId: 1, pais: 'CR', usuarioId: 999 };

    await controlador.pagar(request, datos);

    expect(suscripcionesService.iniciarPago).toHaveBeenCalledWith(
      10,
      datos,
      1,
      expect.anything(),
    );
    expect(suscripcionesService.iniciarPago).not.toHaveBeenCalledWith(
      999,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('arma las URLs de retorno y cancelacion con la direccion del propio servidor', async () => {
    await controlador.pagar(request, dto);

    const urls = (
      suscripcionesService.iniciarPago.mock.calls as unknown[][]
    )[0][3] as {
      retorno: (id: number) => string;
      cancelado: string;
    };
    expect(urls.retorno(25)).toBe(
      'http://api.test:3001/patrocinio/pagos/retorno?s=25',
    );
    expect(urls.cancelado).toBe(
      'http://api.test:3001/patrocinio/pagos/cancelado',
    );
  });

  it('detras de un proxy usa el protocolo que este informa (https en Render)', async () => {
    const detrasDeProxy = {
      ...request,
      get: (cabecera: string) =>
        cabecera === 'host'
          ? 'api.test'
          : cabecera === 'x-forwarded-proto'
            ? 'https, http'
            : undefined,
    } as unknown as RequestAutenticado;

    await controlador.pagar(detrasDeProxy, dto);

    const urls = (
      suscripcionesService.iniciarPago.mock.calls as unknown[][]
    )[0][3] as { cancelado: string };
    expect(urls.cancelado).toBe('https://api.test/patrocinio/pagos/cancelado');
  });

  it('con PUBLIC_BASE_URL usa esa direccion (sin barra final)', async () => {
    process.env.PUBLIC_BASE_URL = 'https://fitquestgo-api.onrender.com/';

    await controlador.pagar(request, dto);

    const urls = (
      suscripcionesService.iniciarPago.mock.calls as unknown[][]
    )[0][3] as {
      retorno: (id: number) => string;
    };
    expect(urls.retorno(25)).toBe(
      'https://fitquestgo-api.onrender.com/patrocinio/pagos/retorno?s=25',
    );
  });

  it('devuelve la respuesta generada por el servicio', async () => {
    await expect(controlador.pagar(request, dto)).resolves.toEqual(respuesta);
  });

  it('propaga los errores del servicio', async () => {
    suscripcionesService.iniciarPago.mockRejectedValue(
      new Error('Error al iniciar el pago'),
    );

    await expect(controlador.pagar(request, dto)).rejects.toThrow(
      'Error al iniciar el pago',
    );
  });
});
