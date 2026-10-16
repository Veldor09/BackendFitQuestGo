
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InsigniasService } from './insignias.service';
import { Insignia, MetricaInsignia } from './insignia.entity';
import { UsuarioInsignia } from './usuario-insignia.entity';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CodigoInsignia, TipoInsignia } from './insignia.enum';

describe('InsigniasService', () => {
  let service: InsigniasService;
  let insigniaRepo: jest.Mocked<Repository<Insignia>>;
  let usuarioInsigniaRepo: jest.Mocked<Repository<UsuarioInsignia>>;
  let notificacionesService: jest.Mocked<NotificacionesService>;
  let consultarMetricas: jest.Mock;

  const crearInsignia = (
    cambios: Partial<Insignia> = {},
  ): Insignia => ({
    id: 1,
    codigo: CodigoInsignia.PrimeraRuta,
    nombre: 'Primera ruta',
    descripcion: 'Registra tu primera ruta',
    emoji: '🥾',
    tipo: TipoInsignia.Hito,
    metrica: MetricaInsignia.Rutas,
    meta: 1,
    activa: true,
    usuariosInsignias: [],
    ...cambios,
  });

  const crearRegistro = (
    idInsignia: number,
    cambios: Partial<UsuarioInsignia> = {},
  ): UsuarioInsignia =>
    ({
      id: idInsignia,
      idUsuario: 10,
      idInsignia,
      obtenidaEn: new Date('2026-10-01T12:00:00.000Z'),
      ...cambios,
    }) as UsuarioInsignia;

  const establecerMetricas = (
    km: number,
    rutas: number,
    alertas: number,
    nodos: number,
  ): void => {
    consultarMetricas
      .mockResolvedValueOnce([{ km, rutas }])
      .mockResolvedValueOnce([{ alertas }])
      .mockResolvedValueOnce([{ nodos }]);
  };

  beforeEach(async () => {
    consultarMetricas = jest.fn();

    const mockInsigniaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      manager: {
        query: consultarMetricas,
      },
    };

    const mockUsuarioInsigniaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    const mockNotificacionesService = {
      crear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsigniasService,
        {
          provide: getRepositoryToken(Insignia),
          useValue: mockInsigniaRepo,
        },
        {
          provide: getRepositoryToken(UsuarioInsignia),
          useValue: mockUsuarioInsigniaRepo,
        },
        {
          provide: NotificacionesService,
          useValue: mockNotificacionesService,
        },
      ],
    }).compile();

    service = module.get<InsigniasService>(InsigniasService);
    insigniaRepo = module.get(getRepositoryToken(Insignia));
    usuarioInsigniaRepo = module.get(getRepositoryToken(UsuarioInsignia));
    notificacionesService = module.get(NotificacionesService);

    insigniaRepo.find.mockResolvedValue([]);
    insigniaRepo.findOne.mockResolvedValue(null);

    usuarioInsigniaRepo.find.mockResolvedValue([]);
    usuarioInsigniaRepo.findOne.mockResolvedValue(null);

    usuarioInsigniaRepo.create.mockImplementation(
      (registro) => registro as UsuarioInsignia,
    );

    usuarioInsigniaRepo.save.mockImplementation(
      async (registro) => registro as UsuarioInsignia,
    );

    notificacionesService.crear.mockResolvedValue(undefined as never);
  });

  it('debe otorgar una insignia y enviar notificación si el usuario no la tiene', async () => {
    const insignia = crearInsignia();

    insigniaRepo.findOne.mockResolvedValue(insignia);

    const otorgada = await service.otorgar(
      10,
      CodigoInsignia.PrimeraRuta,
    );

    expect(otorgada).toBe(true);

    expect(usuarioInsigniaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 10,
        idInsignia: 1,
      }),
    );

    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 10,
        referenciaId: 1,
      }),
    );
  });

  it('debe ser idempotente si el usuario ya tiene la insignia', async () => {
    insigniaRepo.findOne.mockResolvedValue(crearInsignia());

    usuarioInsigniaRepo.findOne.mockResolvedValue(
      crearRegistro(1),
    );

    const otorgada = await service.otorgar(
      10,
      CodigoInsignia.PrimeraRuta,
    );

    expect(otorgada).toBe(false);
    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });

  it('no debe otorgar una insignia inactiva', async () => {
    insigniaRepo.findOne.mockResolvedValue(null);

    const otorgada = await service.otorgar(10, 'RUTAS_5');

    expect(otorgada).toBe(false);
    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });

  it('debe conservar el logro si falla la notificación', async () => {
    insigniaRepo.findOne.mockResolvedValue(crearInsignia());

    notificacionesService.crear.mockRejectedValue(
      new Error('Servicio de notificaciones no disponible'),
    );

    const otorgada = await service.otorgar(
      10,
      CodigoInsignia.PrimeraRuta,
    );

    expect(otorgada).toBe(true);
    expect(usuarioInsigniaRepo.save).toHaveBeenCalledTimes(1);
  });

  it('debe devolver false cuando falla el guardado', async () => {
    insigniaRepo.findOne.mockResolvedValue(crearInsignia());

    usuarioInsigniaRepo.save.mockRejectedValue(
      new Error('Error de base de datos'),
    );

    const otorgada = await service.otorgar(
      10,
      CodigoInsignia.PrimeraRuta,
    );

    expect(otorgada).toBe(false);
    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });

  it('debe calcular el progreso de kilómetros, rutas, alertas y nodos', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        id: 1,
        codigo: 'KM_25',
        metrica: MetricaInsignia.Km,
        tipo: TipoInsignia.Km,
        meta: 25,
      }),
      crearInsignia({
        id: 2,
        codigo: 'RUTAS_10',
        metrica: MetricaInsignia.Rutas,
        meta: 10,
      }),
      crearInsignia({
        id: 3,
        codigo: 'ALERTAS_5',
        metrica: MetricaInsignia.Alertas,
        meta: 5,
      }),
      crearInsignia({
        id: 4,
        codigo: 'NODOS_25',
        metrica: MetricaInsignia.Nodos,
        meta: 25,
      }),
    ]);

    establecerMetricas(12.56, 3, 2, 7);

    const resultado = await service.obtenerInsigniasUsuario(10);

    expect(resultado).toHaveLength(4);

    expect(resultado[0]).toEqual(
      expect.objectContaining({
        codigo: 'KM_25',
        progreso: 12.6,
        meta: 25,
        desbloqueada: false,
      }),
    );

    expect(resultado[1]).toEqual(
      expect.objectContaining({
        codigo: 'RUTAS_10',
        progreso: 3,
        meta: 10,
      }),
    );

    expect(resultado[2]).toEqual(
      expect.objectContaining({
        codigo: 'ALERTAS_5',
        progreso: 2,
        meta: 5,
      }),
    );

    expect(resultado[3]).toEqual(
      expect.objectContaining({
        codigo: 'NODOS_25',
        progreso: 7,
        meta: 25,
      }),
    );
  });

  it('debe limitar el progreso mostrado a la meta', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        codigo: 'RUTAS_5',
        metrica: MetricaInsignia.Rutas,
        meta: 5,
      }),
    ]);

    establecerMetricas(0, 12, 0, 0);

    const resultado = await service.obtenerInsigniasUsuario(10);

    expect(resultado[0].progreso).toBe(5);
    expect(resultado[0].meta).toBe(5);
  });

  it('debe identificar las insignias ya desbloqueadas', async () => {
    insigniaRepo.find.mockResolvedValue([crearInsignia()]);

    usuarioInsigniaRepo.find.mockResolvedValue([
      crearRegistro(1),
    ]);

    establecerMetricas(0, 1, 0, 0);

    const resultado = await service.obtenerInsigniasUsuario(10);

    expect(resultado[0]).toEqual(
      expect.objectContaining({
        desbloqueada: true,
        fechaObtenida: '2026-10-01T12:00:00.000Z',
        progreso: 1,
        meta: 1,
      }),
    );
  });

  it('debe conservar compatibilidad con las insignias originales', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        id: 1,
        codigo: CodigoInsignia.PrimeraRuta,
        metrica: null,
        meta: 1,
      }),
      crearInsignia({
        id: 2,
        codigo: CodigoInsignia.Km10,
        tipo: TipoInsignia.Km,
        metrica: null,
        meta: 10,
      }),
    ]);

    establecerMetricas(8, 1, 0, 0);

    const resultado = await service.obtenerInsigniasUsuario(10);

    expect(resultado[0].progreso).toBe(1);
    expect(resultado[1].progreso).toBe(8);
  });

  it('no debe mostrar progreso ficticio para insignias especiales', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        codigo: 'ESPECIAL_MADRUGADOR',
        metrica: MetricaInsignia.Especial,
        meta: null,
      }),
    ]);

    establecerMetricas(100, 50, 20, 20);

    const resultado = await service.obtenerInsigniasUsuario(10);

    expect(resultado[0].progreso).toBeNull();
    expect(resultado[0].meta).toBeNull();
  });

  it('debe desbloquear automáticamente las metas alcanzadas', async () => {
    const rutas5 = crearInsignia({
      id: 1,
      codigo: 'RUTAS_5',
      metrica: MetricaInsignia.Rutas,
      meta: 5,
    });

    const alertas10 = crearInsignia({
      id: 2,
      codigo: 'ALERTAS_10',
      metrica: MetricaInsignia.Alertas,
      meta: 10,
    });

    const km25 = crearInsignia({
      id: 3,
      codigo: 'KM_25',
      tipo: TipoInsignia.Km,
      metrica: MetricaInsignia.Km,
      meta: 25,
    });

    insigniaRepo.find.mockResolvedValue([
      rutas5,
      alertas10,
      km25,
    ]);

    insigniaRepo.findOne.mockImplementation(async (opciones) => {
      const codigo = opciones?.where &&
        !Array.isArray(opciones.where)
        ? opciones.where.codigo
        : undefined;

      return [rutas5, alertas10, km25].find(
        (insignia) => insignia.codigo === codigo,
      ) ?? null;
    });

    establecerMetricas(30, 6, 3, 0);

    await service.evaluar(10);

    expect(usuarioInsigniaRepo.save).toHaveBeenCalledTimes(2);

    expect(insigniaRepo.findOne).toHaveBeenCalledWith({
      where: {
        codigo: 'RUTAS_5',
        activa: true,
      },
    });

    expect(insigniaRepo.findOne).toHaveBeenCalledWith({
      where: {
        codigo: 'KM_25',
        activa: true,
      },
    });

    expect(insigniaRepo.findOne).not.toHaveBeenCalledWith({
      where: {
        codigo: 'ALERTAS_10',
        activa: true,
      },
    });
  });

  it('no debe evaluar insignias inactivas', async () => {
    insigniaRepo.find.mockResolvedValue([]);

    establecerMetricas(1000, 100, 100, 100);

    await service.evaluar(10);

    expect(insigniaRepo.find).toHaveBeenCalledWith({
      where: { activa: true },
      order: { id: 'ASC' },
    });

    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
  });

  it('no debe volver a otorgar insignias previamente obtenidas', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        codigo: 'RUTAS_5',
        metrica: MetricaInsignia.Rutas,
        meta: 5,
      }),
    ]);

    usuarioInsigniaRepo.find.mockResolvedValue([
      crearRegistro(1),
    ]);

    establecerMetricas(0, 10, 0, 0);

    await service.evaluar(10);

    expect(insigniaRepo.findOne).not.toHaveBeenCalled();
    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
  });

  it('no debe otorgar insignias especiales sin reglas implementadas', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        codigo: 'ESPECIAL_MADRUGADOR',
        metrica: MetricaInsignia.Especial,
        meta: 1,
      }),
    ]);

    establecerMetricas(1000, 100, 100, 100);

    await service.evaluar(10);

    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
  });

  it('debe ignorar metas nulas, cero o negativas', async () => {
    insigniaRepo.find.mockResolvedValue([
      crearInsignia({
        id: 1,
        codigo: 'SIN_META',
        meta: null,
      }),
      crearInsignia({
        id: 2,
        codigo: 'META_CERO',
        meta: 0,
      }),
      crearInsignia({
        id: 3,
        codigo: 'META_NEGATIVA',
        meta: -5,
      }),
    ]);

    establecerMetricas(1000, 100, 100, 100);

    await service.evaluar(10);

    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
  });
});
