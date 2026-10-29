
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

describe('SuscripcionesController - solicitud de suscripcion', () => {
  let controlador: SuscripcionesController;

  let suscripcionesService: {
    solicitarSuscripcion: jest.Mock;
  };

  const request = {
    usuario: {
      id: 10,
      email: 'usuario@ejemplo.com',
      rol: 1,
    },
  } as RequestAutenticado;

  const dto = {
    planId: 1,
    pais: 'CR',
  };

  const respuesta = {
    id: 25,
    usuarioId: 10,
    planId: 1,
    estado: 'Solicitada',
    pais: 'CR',
    moneda: 'CRC',
    creadoEn: new Date('2026-10-22T12:00:00.000Z'),
    mensaje: 'Solicitud de patrocinio registrada correctamente',
  };

  beforeEach(() => {
    suscripcionesService = {
      solicitarSuscripcion: jest.fn().mockResolvedValue(respuesta),
    };

    controlador = new SuscripcionesController(
      suscripcionesService as unknown as SuscripcionesService,
    );
  });

  it('utiliza el identificador del usuario autenticado', async () => {
    await controlador.solicitarSuscripcion(request, dto);

    expect(suscripcionesService.solicitarSuscripcion).toHaveBeenCalledWith(
      10,
      dto,
      1,
    );
  });

  it('envia el plan y el pais al servicio', async () => {
    await controlador.solicitarSuscripcion(request, dto);

    expect(suscripcionesService.solicitarSuscripcion).toHaveBeenCalledWith(
      10,
      {
        planId: 1,
        pais: 'CR',
      },
      1,
    );
  });

  it('no utiliza un identificador de usuario proporcionado en el cuerpo', async () => {
    const datos = {
      planId: 1,
      pais: 'CR',
      usuarioId: 999,
    };

    await controlador.solicitarSuscripcion(request, datos);

    expect(suscripcionesService.solicitarSuscripcion).toHaveBeenCalledWith(
      10,
      datos,
      1,
    );

    expect(suscripcionesService.solicitarSuscripcion).not.toHaveBeenCalledWith(
      999,
      datos,
    );
  });

  it('devuelve la respuesta generada por el servicio', async () => {
    const resultado = await controlador.solicitarSuscripcion(
      request,
      dto,
    );

    expect(resultado).toEqual(respuesta);
  });

  it('propaga los errores del servicio', async () => {
    suscripcionesService.solicitarSuscripcion.mockRejectedValue(
      new Error('Error al solicitar la suscripcion'),
    );

    await expect(
      controlador.solicitarSuscripcion(request, dto),
    ).rejects.toThrow('Error al solicitar la suscripcion');
  });
});
