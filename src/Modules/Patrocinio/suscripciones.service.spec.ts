
import {
  DataSource,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { AuditoriaService } from '../Auditoria/auditoria.service';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import {
  EstadoSuscripcion,
  Suscripcion,
} from './suscripcion.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';

describe('SuscripcionesService - consulta de planes', () => {
  let servicio: SuscripcionesService;
  let planesRepository: { find: jest.Mock };
  let preciosRepository: { find: jest.Mock };

  const planActivo = {
    id: 1,
    nombre: 'Patrocinio mensual',
    duracionDias: 30,
    activo: true,
  };

  beforeEach(() => {
    planesRepository = {
      find: jest.fn().mockResolvedValue([planActivo]),
    };

    preciosRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    servicio = new SuscripcionesService(
      planesRepository as unknown as Repository<PlanPatrocinio>,
      preciosRepository as unknown as Repository<PrecioPatrocinio>,
      {} as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      {} as AuditoriaService,
      {} as DataSource,
    );
  });

  it('consulta Ãºnicamente los planes activos', async () => {
    await servicio.consultarPlanes('CR');

    expect(planesRepository.find).toHaveBeenCalledWith({
      where: { activo: true },
      order: { id: 'ASC' },
    });
  });

  it('devuelve el precio en colones para Costa Rica', async () => {
    preciosRepository.find.mockResolvedValue([
      {
        id: 1,
        planId: 1,
        moneda: 'CRC',
        importe: '10000.00',
        activo: true,
      },
    ]);

    const resultado = await servicio.consultarPlanes('CR');

    expect(resultado).toEqual({
      pais: 'CR',
      moneda: 'CRC',
      metodoPago: 'sinpe',
      pagoDisponible: true,
      sinpeNumero: '83722969',
      planes: [
        {
          id: 1,
          nombre: 'Patrocinio mensual',
          audiencia: undefined,
          duracionDias: 30,
          moneda: 'CRC',
          importe: '10000.00',
        },
      ],
    });

    expect(preciosRepository.find).toHaveBeenCalledWith({
      where: { moneda: 'CRC', activo: true },
    });
  });

  it('selecciona dÃ³lares para Estados Unidos', async () => {
    preciosRepository.find.mockResolvedValue([
      {
        id: 2,
        planId: 1,
        moneda: 'USD',
        importe: '20.00',
        activo: true,
      },
    ]);

    const resultado = await servicio.consultarPlanes('US');

    expect(resultado.moneda).toBe('USD');
    expect(resultado.planes[0].importe).toBe('20.00');
  });

  it('selecciona euros para EspaÃ±a', async () => {
    preciosRepository.find.mockResolvedValue([
      {
        id: 3,
        planId: 1,
        moneda: 'EUR',
        importe: '18.00',
        activo: true,
      },
    ]);

    const resultado = await servicio.consultarPlanes('ES');

    expect(resultado.moneda).toBe('EUR');
    expect(resultado.planes[0].moneda).toBe('EUR');
  });

  it('excluye planes sin precio activo en la moneda solicitada', async () => {
    preciosRepository.find.mockResolvedValue([]);

    const resultado = await servicio.consultarPlanes('CR');

    expect(resultado.planes).toEqual([]);
  });

  it('no incluye precios correspondientes a otros planes', async () => {
    preciosRepository.find.mockResolvedValue([
      {
        id: 4,
        planId: 99,
        moneda: 'CRC',
        importe: '10000.00',
        activo: true,
      },
    ]);

    const resultado = await servicio.consultarPlanes('CR');

    expect(resultado.planes).toEqual([]);
  });

  it('devuelve una lista vacÃ­a cuando no hay planes activos', async () => {
    planesRepository.find.mockResolvedValue([]);

    const resultado = await servicio.consultarPlanes('CR');

    expect(resultado.planes).toEqual([]);
  });

  it('utiliza USD cuando no se proporciona paÃ­s', async () => {
    const resultado = await servicio.consultarPlanes();

    expect(resultado.pais).toBeNull();
    expect(resultado.moneda).toBe('USD');
  });
});

describe('SuscripcionesService - solicitud de suscripcion', () => {
  let servicio: SuscripcionesService;

  let planesRepository: {
    findOne: jest.Mock;
  };

  let preciosRepository: {
    findOne: jest.Mock;
  };

  let suscripcionesRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const usuarioId = 10;

  const dto = {
    planId: 1,
    pais: 'CR',
  };

  const planActivo = {
    id: 1,
    nombre: 'Patrocinio mensual',
    duracionDias: 30,
    activo: true,
  };

  const precioActivo = {
    id: 1,
    planId: 1,
    moneda: 'CRC',
    importe: '10000.00',
    activo: true,
  };

  const suscripcionGuardada = {
    id: 25,
    usuarioId: 10,
    planId: 1,
    estado: 'Solicitada',
    pais: 'CR',
    moneda: 'CRC',
    creadoEn: new Date('2026-10-22T12:00:00.000Z'),
  };

  beforeEach(() => {
    planesRepository = {
      findOne: jest.fn().mockResolvedValue(planActivo),
    };

    preciosRepository = {
      findOne: jest.fn().mockResolvedValue(precioActivo),
    };

    suscripcionesRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((datos) => datos),
      save: jest.fn().mockResolvedValue(suscripcionGuardada),
    };

    servicio = new SuscripcionesService(
      planesRepository as unknown as Repository<PlanPatrocinio>,
      preciosRepository as unknown as Repository<PrecioPatrocinio>,
      suscripcionesRepository as unknown as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      {} as AuditoriaService,
      {} as DataSource,
    );
  });

  it('crea una solicitud pendiente sin activar la suscripcion', async () => {
    const resultado = await servicio.solicitarSuscripcion(
      usuarioId,
      dto,
    );

    expect(planesRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 1,
        activo: true,
      },
    });

    expect(preciosRepository.findOne).toHaveBeenCalledWith({
      where: {
        planId: 1,
        moneda: 'CRC',
        activo: true,
      },
    });

    expect(suscripcionesRepository.create).toHaveBeenCalledWith({
      usuarioId: 10,
      planId: 1,
      estado: 'Solicitada',
      numeroSolicitud: expect.stringMatching(/^[1-9]\d{5}$/),
      pais: 'CR',
      moneda: 'CRC',
      precioAplicado: null,
      iniciaEn: null,
      venceEn: null,
      administradorId: null,
    });

    expect(suscripcionesRepository.save).toHaveBeenCalledTimes(1);

    expect(resultado).toEqual({
      ...suscripcionGuardada,
      // El numero lo genera el servicio (el repositorio falso no lo devuelve).
      numeroSolicitud: undefined,
      monto: '10000.00',
      metodoPago: 'sinpe',
      sinpeNumero: '83722969',
      mensaje: 'Solicitud de patrocinio registrada correctamente',
    });
  });

  it('rechaza un plan inexistente o inactivo', async () => {
    planesRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(preciosRepository.findOne).not.toHaveBeenCalled();
    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza un plan sin precio activo para su moneda', async () => {
    preciosRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una solicitud cuando ya existe otra pendiente', async () => {
    suscripcionesRepository.findOne.mockResolvedValue({
      id: 7,
      usuarioId,
      estado: 'Solicitada',
    });

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una solicitud cuando ya existe una suscripcion activa', async () => {
    suscripcionesRepository.findOne.mockResolvedValue({
      id: 8,
      usuarioId,
      estado: 'Activa',
    });

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
  });

  it('consulta tanto solicitudes pendientes como suscripciones activas', async () => {
    await servicio.solicitarSuscripcion(usuarioId, dto);

    expect(suscripcionesRepository.findOne).toHaveBeenCalledWith({
      where: [
        {
          usuarioId: 10,
          estado: 'Solicitada',
        },
        {
          usuarioId: 10,
          estado: 'Activa',
        },
      ],
    });
  });

  it('convierte un conflicto de unicidad de PostgreSQL en HTTP 409', async () => {
    const error = new QueryFailedError(
      'INSERT INTO suscripciones ...',
      [],
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      } as Error & { code: string },
    );

    suscripcionesRepository.save.mockRejectedValue(error);

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('propaga errores inesperados de la base de datos', async () => {
    const error = new Error('Fallo inesperado');

    suscripcionesRepository.save.mockRejectedValue(error);

    await expect(
      servicio.solicitarSuscripcion(usuarioId, dto),
    ).rejects.toThrow('Fallo inesperado');
  });

  it('mantiene la solicitud sin fechas ni aprobacion automatica', async () => {
    await servicio.solicitarSuscripcion(usuarioId, dto);

    const datos = suscripcionesRepository.create.mock.calls[0][0];

    expect(datos.estado).toBe('Solicitada');
    expect(datos.iniciaEn).toBeNull();
    expect(datos.venceEn).toBeNull();
    expect(datos.precioAplicado).toBeNull();
    expect(datos.administradorId).toBeNull();
  });
});

describe('SuscripcionesService - aprobacion administrativa', () => {
  let servicio: SuscripcionesService;

  let suscripcionesRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  let planesRepository: {
    findOne: jest.Mock;
  };

  let preciosRepository: {
    findOne: jest.Mock;
  };

  let auditoriaService: {
    registrar: jest.Mock;
  };

  let manager: {
    getRepository: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  const suscripcionId = 25;
  const administradorId = 3;

  const crearSolicitud = () => ({
    id: suscripcionId,
    usuarioId: 10,
    planId: 1,
    estado: EstadoSuscripcion.Solicitada,
    pais: 'CR',
    moneda: 'CRC',
    precioAplicado: null,
    iniciaEn: null,
    venceEn: null,
    administradorId: null,
  });

  beforeEach(() => {
    suscripcionesRepository = {
      findOne: jest.fn().mockImplementation(async () => crearSolicitud()),
      save: jest.fn().mockImplementation(async (datos) => datos),
    };

    planesRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        nombre: 'Patrocinio mensual',
        duracionDias: 30,
        activo: true,
      }),
    };

    preciosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        planId: 1,
        moneda: 'CRC',
        importe: '10000.00',
        activo: true,
      }),
    };

    auditoriaService = {
      registrar: jest.fn().mockResolvedValue({
        id: 100,
      }),
    };

    manager = {
      getRepository: jest.fn().mockImplementation((entidad) => {
        if (entidad === Suscripcion) {
          return suscripcionesRepository;
        }

        if (entidad === PlanPatrocinio) {
          return planesRepository;
        }

        if (entidad === PrecioPatrocinio) {
          return preciosRepository;
        }

        throw new Error('Repositorio no configurado en la prueba');
      }),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(
        async (operacion) => operacion(manager),
      ),
    };

    servicio = new SuscripcionesService(
      {} as Repository<PlanPatrocinio>,
      {} as Repository<PrecioPatrocinio>,
      {} as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      auditoriaService as unknown as AuditoriaService,
      dataSource as unknown as DataSource,
    );
  });

  it('aprueba una solicitud pendiente dentro de una transaccion', async () => {
    const resultado = await servicio.aprobarSuscripcion(
      suscripcionId,
      administradorId,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(suscripcionesRepository.save).toHaveBeenCalledTimes(1);

    expect(resultado).toMatchObject({
      id: 25,
      usuarioId: 10,
      planId: 1,
      estado: EstadoSuscripcion.Activa,
      moneda: 'CRC',
      precioAplicado: '10000.00',
      administradorId: 3,
      mensaje: 'Suscripcion aprobada correctamente',
    });
  });

  it('bloquea la fila para evitar aprobaciones simultaneas', async () => {
    await servicio.aprobarSuscripcion(
      suscripcionId,
      administradorId,
    );

    expect(suscripcionesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 25 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('calcula el vencimiento utilizando la duracion del plan', async () => {
    planesRepository.findOne.mockResolvedValue({
      id: 1,
      duracionDias: 45,
      activo: true,
    });

    const resultado = await servicio.aprobarSuscripcion(
      suscripcionId,
      administradorId,
    );

    const diferencia =
      resultado.venceEn!.getTime() - resultado.iniciaEn!.getTime();

    expect(diferencia).toBe(45 * 24 * 60 * 60 * 1000);
  });

  it('guarda el precio vigente y el administrador responsable', async () => {
    await servicio.aprobarSuscripcion(
      suscripcionId,
      administradorId,
    );

    expect(suscripcionesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoSuscripcion.Activa,
        precioAplicado: '10000.00',
        administradorId: 3,
        iniciaEn: expect.any(Date),
        venceEn: expect.any(Date),
      }),
    );

    expect(preciosRepository.findOne).toHaveBeenCalledWith({
      where: {
        planId: 1,
        moneda: 'CRC',
        activo: true,
      },
    });
  });

  it('registra la auditoria utilizando el manager de la transaccion', async () => {
    await servicio.aprobarSuscripcion(
      suscripcionId,
      administradorId,
    );

    expect(auditoriaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        administradorId: 3,
        accion: 'APROBAR_SUSCRIPCION',
        entidad: 'suscripciones',
        entidadId: 25,
        detalle: expect.objectContaining({
          usuarioId: 10,
          planId: 1,
          moneda: 'CRC',
          precioAplicado: '10000.00',
        }),
      }),
      manager,
    );
  });

  it('rechaza la aprobacion de una suscripcion inexistente', async () => {
    suscripcionesRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.aprobarSuscripcion(suscripcionId, administradorId),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('impide aprobar una suscripcion que ya esta activa', async () => {
    suscripcionesRepository.findOne.mockResolvedValue({
      ...crearSolicitud(),
      estado: EstadoSuscripcion.Activa,
    });

    await expect(
      servicio.aprobarSuscripcion(suscripcionId, administradorId),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('rechaza la aprobacion si el plan esta inactivo', async () => {
    planesRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.aprobarSuscripcion(suscripcionId, administradorId),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('rechaza la aprobacion si no existe un precio activo', async () => {
    preciosRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.aprobarSuscripcion(suscripcionId, administradorId),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('propaga el error de auditoria para que la transaccion se revierta', async () => {
    auditoriaService.registrar.mockRejectedValue(
      new Error('Error al registrar auditoria'),
    );

    await expect(
      servicio.aprobarSuscripcion(suscripcionId, administradorId),
    ).rejects.toThrow('Error al registrar auditoria');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(suscripcionesRepository.save).toHaveBeenCalledTimes(1);
  });
});

describe('SuscripcionesService - rechazo administrativo', () => {
  let servicio: SuscripcionesService;

  let suscripcionesRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  let auditoriaService: {
    registrar: jest.Mock;
  };

  let manager: {
    getRepository: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  const suscripcionId = 25;
  const administradorId = 3;

  const dto = {
    motivo: 'La solicitud no cumple con los requisitos de patrocinio',
  };

  const crearSolicitud = () => ({
    id: suscripcionId,
    usuarioId: 10,
    planId: 1,
    estado: EstadoSuscripcion.Solicitada,
    pais: 'CR',
    moneda: 'CRC',
    precioAplicado: null,
    iniciaEn: null,
    venceEn: null,
    administradorId: null,
  });

  beforeEach(() => {
    suscripcionesRepository = {
      findOne: jest.fn().mockImplementation(async () => crearSolicitud()),
      save: jest.fn().mockImplementation(async (datos) => datos),
    };

    auditoriaService = {
      registrar: jest.fn().mockResolvedValue({ id: 101 }),
    };

    manager = {
      getRepository: jest.fn().mockImplementation((entidad) => {
        if (entidad === Suscripcion) {
          return suscripcionesRepository;
        }

        throw new Error('Repositorio no configurado en la prueba');
      }),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(
        async (operacion) => operacion(manager),
      ),
    };

    servicio = new SuscripcionesService(
      {} as Repository<PlanPatrocinio>,
      {} as Repository<PrecioPatrocinio>,
      {} as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      auditoriaService as unknown as AuditoriaService,
      dataSource as unknown as DataSource,
    );
  });

  it('rechaza una solicitud pendiente dentro de una transaccion', async () => {
    const resultado = await servicio.rechazarSuscripcion(
      suscripcionId,
      administradorId,
      dto,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(suscripcionesRepository.save).toHaveBeenCalledTimes(1);

    expect(resultado).toMatchObject({
      id: 25,
      usuarioId: 10,
      planId: 1,
      estado: EstadoSuscripcion.Rechazada,
      administradorId: 3,
      motivo: dto.motivo,
      mensaje: 'Suscripcion rechazada correctamente',
    });
  });

  it('bloquea la fila para evitar decisiones simultaneas', async () => {
    await servicio.rechazarSuscripcion(
      suscripcionId,
      administradorId,
      dto,
    );

    expect(suscripcionesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 25 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('guarda el estado rechazado y el administrador responsable', async () => {
    await servicio.rechazarSuscripcion(
      suscripcionId,
      administradorId,
      dto,
    );

    expect(suscripcionesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoSuscripcion.Rechazada,
        administradorId: 3,
        precioAplicado: null,
        iniciaEn: null,
        venceEn: null,
      }),
    );
  });

  it('registra el motivo en auditoria dentro de la transaccion', async () => {
    await servicio.rechazarSuscripcion(
      suscripcionId,
      administradorId,
      dto,
    );

    expect(auditoriaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        administradorId: 3,
        accion: 'RECHAZAR_SUSCRIPCION',
        entidad: 'suscripciones',
        entidadId: 25,
        detalle: expect.objectContaining({
          usuarioId: 10,
          planId: 1,
          estadoAnterior: EstadoSuscripcion.Solicitada,
          estadoNuevo: EstadoSuscripcion.Rechazada,
          motivo: dto.motivo,
        }),
      }),
      manager,
    );
  });

  it('rechaza una suscripcion inexistente', async () => {
    suscripcionesRepository.findOne.mockResolvedValue(null);

    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        dto,
      ),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('impide rechazar una suscripcion activa', async () => {
    suscripcionesRepository.findOne.mockResolvedValue({
      ...crearSolicitud(),
      estado: EstadoSuscripcion.Activa,
    });

    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        dto,
      ),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('impide rechazar dos veces la misma solicitud', async () => {
    suscripcionesRepository.findOne.mockResolvedValue({
      ...crearSolicitud(),
      estado: EstadoSuscripcion.Rechazada,
    });

    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        dto,
      ),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(suscripcionesRepository.save).not.toHaveBeenCalled();
    expect(auditoriaService.registrar).not.toHaveBeenCalled();
  });

  it('rechaza un motivo demasiado corto', async () => {
    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        { motivo: 'No cumple' },
      ),
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza un motivo compuesto solamente por espacios', async () => {
    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        { motivo: '               ' },
      ),
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza un motivo superior a 500 caracteres', async () => {
    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        { motivo: 'A'.repeat(501) },
      ),
    ).rejects.toMatchObject({
      status: 400,
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('elimina espacios exteriores del motivo antes de auditar', async () => {
    const resultado = await servicio.rechazarSuscripcion(
      suscripcionId,
      administradorId,
      { motivo: `  ${dto.motivo}  ` },
    );

    expect(resultado.motivo).toBe(dto.motivo);

    expect(auditoriaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalle: expect.objectContaining({
          motivo: dto.motivo,
        }),
      }),
      manager,
    );
  });

  it('propaga un error de auditoria dentro de la transaccion', async () => {
    auditoriaService.registrar.mockRejectedValue(
      new Error('Error al registrar auditoria'),
    );

    await expect(
      servicio.rechazarSuscripcion(
        suscripcionId,
        administradorId,
        dto,
      ),
    ).rejects.toThrow('Error al registrar auditoria');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(suscripcionesRepository.save).toHaveBeenCalledTimes(1);
  });
});
