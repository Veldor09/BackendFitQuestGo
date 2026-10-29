import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../Auditoria/auditoria.service';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { EstadoSuscripcion, Suscripcion } from './suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';

describe('SuscripcionesService.miSuscripcion', () => {
  let suscripciones: { findOne: jest.Mock };
  let planes: { findOne: jest.Mock };
  let precios: { findOne: jest.Mock };
  let servicio: SuscripcionesService;

  const DIA = 24 * 60 * 60 * 1000;
  const fila = (extra: Partial<Suscripcion> = {}) =>
    ({
      id: 5,
      usuarioId: 10,
      planId: 1,
      estado: EstadoSuscripcion.Solicitada,
      moneda: 'CRC',
      precioAplicado: null,
      iniciaEn: null,
      venceEn: null,
      creadoEn: new Date('2026-10-01T00:00:00Z'),
      ...extra,
    }) as Suscripcion;

  beforeEach(() => {
    suscripciones = { findOne: jest.fn() };
    planes = {
      findOne: jest.fn().mockResolvedValue({ id: 1, nombre: 'Plan Mensual' }),
    };
    precios = { findOne: jest.fn().mockResolvedValue({ importe: '10000.00' }) };
    servicio = new SuscripcionesService(
      planes as unknown as Repository<PlanPatrocinio>,
      precios as unknown as Repository<PrecioPatrocinio>,
      suscripciones as unknown as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      {} as AuditoriaService,
      {} as DataSource,
    );
  });

  it('pide la mas reciente de ESA persona', async () => {
    suscripciones.findOne.mockResolvedValue(null);

    await servicio.miSuscripcion(10);

    expect(suscripciones.findOne).toHaveBeenCalledWith({
      where: { usuarioId: 10 },
      order: { creadoEn: 'DESC', id: 'DESC' },
    });
  });

  it('quien nunca pidio un plan recibe null', async () => {
    suscripciones.findOne.mockResolvedValue(null);
    await expect(servicio.miSuscripcion(10)).resolves.toBeNull();
  });

  it('una solicitud pendiente no esta vigente', async () => {
    suscripciones.findOne.mockResolvedValue(fila());
    await expect(servicio.miSuscripcion(10)).resolves.toMatchObject({
      estado: 'Solicitada',
      vigente: false,
      planNombre: 'Plan Mensual',
    });
  });

  it('activa y sin vencer esta vigente', async () => {
    suscripciones.findOne.mockResolvedValue(
      fila({
        estado: EstadoSuscripcion.Activa,
        iniciaEn: new Date(Date.now() - DIA),
        venceEn: new Date(Date.now() + 10 * DIA),
      }),
    );
    await expect(servicio.miSuscripcion(10)).resolves.toMatchObject({
      vigente: true,
    });
  });

  it('activa pero con la fecha vencida NO esta vigente (manda la fecha)', async () => {
    suscripciones.findOne.mockResolvedValue(
      fila({
        estado: EstadoSuscripcion.Activa,
        iniciaEn: new Date(Date.now() - 40 * DIA),
        venceEn: new Date(Date.now() - DIA),
      }),
    );
    await expect(servicio.miSuscripcion(10)).resolves.toMatchObject({
      estado: 'Activa',
      vigente: false,
    });
  });

  it('si el plan ya no existe devuelve el nombre en null en vez de fallar', async () => {
    planes.findOne.mockResolvedValue(null);
    suscripciones.findOne.mockResolvedValue(fila());
    await expect(servicio.miSuscripcion(10)).resolves.toMatchObject({
      planNombre: null,
    });
  });
});
