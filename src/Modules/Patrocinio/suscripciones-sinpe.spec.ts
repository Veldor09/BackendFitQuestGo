import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../Auditoria/auditoria.service';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { audienciaParaRol, metodoPagoParaPais, pagoDisponible } from './pago';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { EstadoSuscripcion, Suscripcion } from './suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';

describe('pago.ts', () => {
  it('Costa Rica paga con SINPE; el resto del mundo con PayPal (aun no disponible)', () => {
    expect(metodoPagoParaPais('CR')).toBe('sinpe');
    expect(metodoPagoParaPais(' cr ')).toBe('sinpe');
    expect(metodoPagoParaPais('US')).toBe('paypal');
    expect(metodoPagoParaPais(undefined)).toBe('paypal');
    expect(pagoDisponible('sinpe')).toBe(true);
    expect(pagoDisponible('paypal')).toBe(false);
  });

  it('las empresas ven planes de empresa y todos los demas, de usuario', () => {
    expect(audienciaParaRol(2)).toBe('empresa');
    expect(audienciaParaRol(1)).toBe('usuario');
    expect(audienciaParaRol(3)).toBe('usuario');
  });
});

describe('SuscripcionesService - SINPE, audiencia y gestion', () => {
  let planes: { find: jest.Mock; findOne: jest.Mock };
  let precios: { find: jest.Mock; findOne: jest.Mock };
  let suscripciones: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let servicio: SuscripcionesService;

  const planUsuario = {
    id: 2,
    nombre: 'Plan Explorador',
    duracionDias: 30,
    activo: true,
    audiencia: 'usuario',
  };

  beforeEach(() => {
    planes = {
      find: jest.fn().mockResolvedValue([planUsuario]),
      findOne: jest.fn().mockResolvedValue(planUsuario),
    };
    precios = {
      find: jest
        .fn()
        .mockResolvedValue([
          { planId: 2, moneda: 'CRC', importe: '2500.00', activo: true },
        ]),
      findOne: jest.fn().mockResolvedValue({ importe: '2500.00' }),
    };
    suscripciones = {
      // 1a llamada: numero libre?; 2a: ya tiene solicitud?
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((x: object) => x),
      save: jest
        .fn()
        .mockImplementation((x: object) =>
          Promise.resolve({ id: 7, creadoEn: new Date('2026-10-29'), ...x }),
        ),
      createQueryBuilder: jest.fn(),
    };
    servicio = new SuscripcionesService(
      planes as unknown as Repository<PlanPatrocinio>,
      precios as unknown as Repository<PrecioPatrocinio>,
      suscripciones as unknown as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      {} as AuditoriaService,
      {} as DataSource,
    );
  });

  describe('consultarPlanes', () => {
    it('filtra por audiencia cuando se la dan', async () => {
      await servicio.consultarPlanes('CR', 'usuario');
      expect(planes.find).toHaveBeenCalledWith({
        where: { activo: true, audiencia: 'usuario' },
        order: { id: 'ASC' },
      });
    });

    it('en Costa Rica dice que se paga por SINPE y a que numero', async () => {
      const r = await servicio.consultarPlanes('CR', 'usuario');
      expect(r).toMatchObject({
        metodoPago: 'sinpe',
        pagoDisponible: true,
        sinpeNumero: '83722969',
      });
    });

    it('fuera de Costa Rica muestra los planes pero avisa que el pago aun no esta disponible', async () => {
      precios.find.mockResolvedValue([
        { planId: 2, moneda: 'USD', importe: '5.00', activo: true },
      ]);
      const r = await servicio.consultarPlanes('US', 'usuario');
      expect(r).toMatchObject({
        moneda: 'USD',
        metodoPago: 'paypal',
        pagoDisponible: false,
        sinpeNumero: null,
      });
      expect(r.planes).toHaveLength(1);
    });
  });

  describe('solicitarSuscripcion', () => {
    const dto = { planId: 2, pais: 'CR' };

    it('guarda un numero de solicitud de 6 digitos y devuelve las indicaciones del pago', async () => {
      const r = await servicio.solicitarSuscripcion(10, dto, 1);

      expect(r.numeroSolicitud).toMatch(/^[1-9]\d{5}$/);
      expect(suscripciones.create).toHaveBeenCalledWith(
        expect.objectContaining({ numeroSolicitud: r.numeroSolicitud }),
      );
      expect(r).toMatchObject({
        estado: 'Solicitada',
        monto: '2500.00',
        metodoPago: 'sinpe',
        sinpeNumero: '83722969',
      });
    });

    it('si el numero ya lo tiene otra solicitud, saca otro', async () => {
      let numerosProbados = 0;
      suscripciones.findOne.mockImplementation(
        (opciones: { where: { numeroSolicitud?: string } }) => {
          if (opciones.where.numeroSolicitud === undefined)
            return Promise.resolve(null);
          numerosProbados++;
          // El primero ya existe; el segundo esta libre.
          return Promise.resolve(numerosProbados === 1 ? { id: 1 } : null);
        },
      );

      const r = await servicio.solicitarSuscripcion(10, dto, 1);

      expect(r.numeroSolicitud).toMatch(/^\d{6}$/);
      expect(numerosProbados).toBe(2);
    });

    it('un usuario no puede pedir un plan de empresa (403 PLAN_NO_APLICA)', async () => {
      planes.findOne.mockResolvedValue({
        ...planUsuario,
        audiencia: 'empresa',
      });

      await expect(
        servicio.solicitarSuscripcion(10, dto, 1),
      ).rejects.toMatchObject({
        status: 403,
        message: 'PLAN_NO_APLICA',
      });
      expect(suscripciones.save).not.toHaveBeenCalled();
    });

    it('una empresa no puede pedir un plan de usuario', async () => {
      await expect(
        servicio.solicitarSuscripcion(20, dto, 2),
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it('fuera de Costa Rica no se puede solicitar todavia (400 PAGO_NO_DISPONIBLE)', async () => {
      await expect(
        servicio.solicitarSuscripcion(10, { planId: 2, pais: 'US' }, 1),
      ).rejects.toMatchObject({ status: 400, message: 'PAGO_NO_DISPONIBLE' });
      expect(suscripciones.save).not.toHaveBeenCalled();
    });

    it('si ya tiene una solicitud o plan sigue dando 409', async () => {
      suscripciones.findOne.mockImplementation((opciones: { where: unknown }) =>
        Promise.resolve(Array.isArray(opciones.where) ? { id: 99 } : null),
      );
      await expect(
        servicio.solicitarSuscripcion(10, dto, 1),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listarSuscripciones (admin)', () => {
    const armarConsulta = () => {
      const q: Record<string, jest.Mock> = {};
      for (const m of [
        'innerJoin',
        'leftJoin',
        'select',
        'orderBy',
        'addOrderBy',
        'limit',
        'andWhere',
      ]) {
        q[m] = jest.fn().mockReturnValue(q);
      }
      q.getRawMany = jest.fn().mockResolvedValue([{ id: 1 }]);
      suscripciones.createQueryBuilder.mockReturnValue(q);
      return q;
    };

    it('sin filtros trae las mas recientes', async () => {
      const q = armarConsulta();
      await expect(servicio.listarSuscripciones()).resolves.toEqual([
        { id: 1 },
      ]);
      expect(q.andWhere).not.toHaveBeenCalled();
      expect(q.limit).toHaveBeenCalledWith(200);
    });

    it('filtra por estado y busca por numero, nombre o correo', async () => {
      const q = armarConsulta();
      await servicio.listarSuscripciones({
        estado: 'Solicitada',
        q: ' 123456 ',
      });

      expect(q.andWhere).toHaveBeenCalledWith('s.estado = :estado', {
        estado: 'Solicitada',
      });
      expect(q.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('s.numeroSolicitud = :exacto'),
        { exacto: '123456', parcial: '%123456%' },
      );
    });
  });

  describe('suspenderSuscripcion', () => {
    let avisos: { planSuspendido: jest.Mock };
    let repoTx: { findOne: jest.Mock; save: jest.Mock };
    let auditoria: { registrar: jest.Mock };

    beforeEach(() => {
      avisos = { planSuspendido: jest.fn().mockResolvedValue(undefined) };
      auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      repoTx = {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          usuarioId: 10,
          planId: 2,
          estado: EstadoSuscripcion.Activa,
        }),
        save: jest.fn().mockImplementation((x: object) => Promise.resolve(x)),
      };
      servicio = new SuscripcionesService(
        planes as unknown as Repository<PlanPatrocinio>,
        precios as unknown as Repository<PrecioPatrocinio>,
        suscripciones as unknown as Repository<Suscripcion>,
        {} as Repository<RenovacionSuscripcion>,
        auditoria as unknown as AuditoriaService,
        {
          transaction: jest
            .fn()
            .mockImplementation((op: (m: unknown) => unknown) =>
              Promise.resolve(op({ getRepository: () => repoTx })),
            ),
        } as unknown as DataSource,
        avisos as unknown as PatrocinioAvisosService,
      );
    });

    it('pasa una activa a suspendida, lo deja en auditoria y avisa al dueno', async () => {
      const r = await servicio.suspenderSuscripcion(5, 3);

      expect(r).toMatchObject({ id: 5, estado: 'Suspendida' });
      expect(repoTx.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'Suspendida', administradorId: 3 }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'SUSPENDER_SUSCRIPCION',
          entidadId: 5,
        }),
        expect.anything(),
      );
      expect(avisos.planSuspendido).toHaveBeenCalledWith(10, 5);
    });

    it('solo se suspenden las activas', async () => {
      repoTx.findOne.mockResolvedValue({
        id: 5,
        usuarioId: 10,
        estado: EstadoSuscripcion.Solicitada,
      });
      await expect(servicio.suspenderSuscripcion(5, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(avisos.planSuspendido).not.toHaveBeenCalled();
    });

    it('una suscripcion inexistente da 404', async () => {
      repoTx.findOne.mockResolvedValue(null);
      await expect(servicio.suspenderSuscripcion(5, 3)).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
