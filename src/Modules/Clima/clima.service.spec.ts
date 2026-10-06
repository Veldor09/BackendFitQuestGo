import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ClimaService,
  MAX_ZONAS_EN_CACHE,
  VIGENCIA_CACHE_MS,
} from './clima.service';
import {
  HoraPronostico,
  NivelAlertaClima,
  TipoAlertaClima,
} from './clima.tipos';
import { ErrorProveedorClima, OpenMeteoCliente } from './open-meteo.cliente';

const tranquila = (): HoraPronostico[] =>
  Array.from({ length: 4 }, () => ({
    precipitacionMmH: 0,
    sensacionC: 22,
    codigoWmo: 3,
  }));

/** Aguacero fuerte dentro de una hora. */
const conAguacero = (): HoraPronostico[] => {
  const horas = tranquila();
  horas[1] = { precipitacionMmH: 12, sensacionC: 22, codigoWmo: 65 };
  return horas;
};

describe('ClimaService', () => {
  let service: ClimaService;
  let proveedor: {
    pronostico: jest.Mock<Promise<HoraPronostico[]>, [number, number]>;
  };
  let ahora: jest.SpiedFunction<typeof Date.now>;
  let aviso: jest.SpiedFunction<typeof Logger.prototype.warn>;
  let reloj: number;

  beforeEach(async () => {
    reloj = new Date('2026-10-06T12:00:00Z').getTime();
    ahora = jest.spyOn(Date, 'now').mockImplementation(() => reloj);
    aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    proveedor = {
      pronostico: jest
        .fn<Promise<HoraPronostico[]>, [number, number]>()
        .mockResolvedValue(tranquila()),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        ClimaService,
        { provide: OpenMeteoCliente, useValue: proveedor },
      ],
    }).compile();
    service = modulo.get(ClimaService);
  });

  afterEach(() => {
    ahora.mockRestore();
    jest.restoreAllMocks();
  });

  it('sin mal tiempo en la zona no hay alertas', async () => {
    const respuesta = await service.alertas(9.93, -84.09);
    expect(respuesta.alertas).toEqual([]);
    expect(respuesta.fuente).toBe('Open-Meteo');
  });

  it('devuelve las alertas del pronostico de la zona', async () => {
    proveedor.pronostico.mockResolvedValue(conAguacero());

    const { alertas } = await service.alertas(9.93, -84.09);

    expect(alertas).toEqual([
      {
        tipo: TipoAlertaClima.Lluvia,
        nivel: NivelAlertaClima.Precaucion,
        enHoras: 1,
        valor: 12,
      },
    ]);
  });

  it('dice cuando se consulto el proveedor', async () => {
    const respuesta = await service.alertas(9.93, -84.09);
    expect(respuesta.actualizadoEn).toBe('2026-10-06T12:00:00.000Z');
  });

  it('consulta con la posicion redondeada a 2 decimales (~1 km), no la exacta', async () => {
    await service.alertas(9.928123, -84.090789);
    expect(proveedor.pronostico).toHaveBeenCalledWith(9.93, -84.09);
  });

  describe('cache', () => {
    it('dos consultas de la misma zona usan una sola llamada al proveedor', async () => {
      await service.alertas(9.9281, -84.0907);
      await service.alertas(9.9312, -84.0881); // misma celda de ~1 km

      expect(proveedor.pronostico).toHaveBeenCalledTimes(1);
    });

    it('la segunda consulta devuelve lo mismo que la primera', async () => {
      proveedor.pronostico.mockResolvedValue(conAguacero());
      const primera = await service.alertas(9.93, -84.09);
      const segunda = await service.alertas(9.93, -84.09);
      expect(segunda).toEqual(primera);
    });

    it('otra zona consulta de nuevo', async () => {
      await service.alertas(9.93, -84.09);
      await service.alertas(10.5, -85.2);

      expect(proveedor.pronostico).toHaveBeenCalledTimes(2);
    });

    it('pasada la vigencia vuelve a consultar', async () => {
      await service.alertas(9.93, -84.09);
      reloj += VIGENCIA_CACHE_MS + 1;
      await service.alertas(9.93, -84.09);

      expect(proveedor.pronostico).toHaveBeenCalledTimes(2);
    });

    it('dentro de la vigencia no vuelve a consultar', async () => {
      await service.alertas(9.93, -84.09);
      reloj += VIGENCIA_CACHE_MS - 1;
      await service.alertas(9.93, -84.09);

      expect(proveedor.pronostico).toHaveBeenCalledTimes(1);
    });

    it('consultas simultaneas de la misma zona comparten la llamada en curso', async () => {
      let responder!: (horas: HoraPronostico[]) => void;
      proveedor.pronostico.mockReturnValue(
        new Promise<HoraPronostico[]>((resolve) => {
          responder = resolve;
        }),
      );

      const a = service.alertas(9.93, -84.09);
      const b = service.alertas(9.931, -84.091);
      responder(conAguacero());
      const [ra, rb] = await Promise.all([a, b]);

      expect(proveedor.pronostico).toHaveBeenCalledTimes(1);
      expect(rb).toEqual(ra);
    });

    it('no guarda mas zonas que el maximo: descarta la mas antigua', async () => {
      for (let i = 0; i < MAX_ZONAS_EN_CACHE + 1; i++) {
        await service.alertas(i * 0.1, 0);
      }
      proveedor.pronostico.mockClear();

      await service.alertas(0, 0); // la primera ya se descarto
      expect(proveedor.pronostico).toHaveBeenCalledTimes(1);

      proveedor.pronostico.mockClear();
      await service.alertas(MAX_ZONAS_EN_CACHE * 0.1, 0); // la ultima sigue
      expect(proveedor.pronostico).not.toHaveBeenCalled();
    });
  });

  describe('si el proveedor falla', () => {
    it('responde 503 (el servicio del clima no esta disponible)', async () => {
      proveedor.pronostico.mockRejectedValue(
        new ErrorProveedorClima('respondio 500'),
      );
      await expect(service.alertas(9.93, -84.09)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('no guarda el fallo: la proxima consulta vuelve a intentar', async () => {
      proveedor.pronostico.mockRejectedValueOnce(
        new ErrorProveedorClima('respondio 500'),
      );
      await expect(service.alertas(9.93, -84.09)).rejects.toBeDefined();

      await expect(service.alertas(9.93, -84.09)).resolves.toBeDefined();
      expect(proveedor.pronostico).toHaveBeenCalledTimes(2);
    });

    it('deja constancia en el log', async () => {
      proveedor.pronostico.mockRejectedValue(
        new ErrorProveedorClima('respondio 500'),
      );
      await expect(service.alertas(9.93, -84.09)).rejects.toBeDefined();
      expect(aviso).toHaveBeenCalledWith(
        expect.stringContaining('respondio 500'),
      );
    });

    it('un error inesperado no se disfraza de 503', async () => {
      const bug = new TypeError('algo propio');
      proveedor.pronostico.mockRejectedValue(bug);
      await expect(service.alertas(9.93, -84.09)).rejects.toBe(bug);
    });
  });
});
