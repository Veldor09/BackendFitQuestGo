
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { CatalogosService } from '../Catalogos/catalogos.service';
import { ActividadRuta } from './actividad-ruta.enum';
import { EstadoRuta } from './estado-ruta.enum';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

const DUENO = 7;

const dueno: UsuarioAutenticado = {
  id: DUENO,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};

const otra: UsuarioAutenticado = {
  id: 99,
  email: 'luis@x.co',
  rol: RoleId.UserNormal,
};

const admin: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};

const ruta = (estado: EstadoRuta): Ruta =>
  Object.assign(new Ruta(), {
    id: 5,
    nombre: 'Sendero',
    actividades: [ActividadRuta.Running],
    dificultad: 'moderada',
    distanciaKm: 5,
    puntos: [{ lat: 9.93, lng: -84.09 }],
    estado,
    creadoPor: { id: DUENO } as User,
    creadoEn: new Date(),
  });

describe('RutaService.verRuta (GET /rutas/:id)', () => {
  let service: RutaService;
  let rutas: {
    findOne: jest.Mock<Promise<Ruta | null>, [unknown]>;
  };

  beforeEach(() => {
    rutas = {
      findOne: jest.fn<Promise<Ruta | null>, [unknown]>(),
    };

    // Estas pruebas solo ejercitan verRuta.
    // Los demas repositorios y servicios no intervienen aqui.
    service = new (
      RutaService as unknown as new (
        rutas: unknown,
      ) => RutaService
    )(rutas);
  });

  it('404 si la ruta no existe', async () => {
    rutas.findOne.mockResolvedValue(null);

    await expect(
      service.verRuta(5, otra),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('una ruta publicada la ve cualquier usuario', async () => {
    rutas.findOne.mockResolvedValue(
      ruta(EstadoRuta.Publicada),
    );

    await expect(
      service.verRuta(5, otra),
    ).resolves.toMatchObject({ id: 5 });
  });

  it.each([
    EstadoRuta.Privada,
    EstadoRuta.Pendiente,
    EstadoRuta.Rechazada,
  ])(
    'una ruta %s no la ve otra persona: 404, como si no existiera',
    async (estado) => {
      rutas.findOne.mockResolvedValue(ruta(estado));

      await expect(
        service.verRuta(5, otra),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it.each([
    EstadoRuta.Privada,
    EstadoRuta.Pendiente,
    EstadoRuta.Publicada,
    EstadoRuta.Rechazada,
  ])(
    'quien la creo ve la suya en estado %s',
    async (estado) => {
      rutas.findOne.mockResolvedValue(ruta(estado));

      await expect(
        service.verRuta(5, dueno),
      ).resolves.toMatchObject({ id: 5 });
    },
  );

  it.each([
    EstadoRuta.Privada,
    EstadoRuta.Pendiente,
    EstadoRuta.Publicada,
    EstadoRuta.Rechazada,
  ])(
    'el admin ve una ruta %s (para moderar)',
    async (estado) => {
      rutas.findOne.mockResolvedValue(ruta(estado));

      await expect(
        service.verRuta(5, admin),
      ).resolves.toMatchObject({ id: 5 });
    },
  );
});

describe('RutaService — actividades dinamicas ADM-11', () => {
  let service: RutaService;

  let rutas: {
    create: jest.Mock;
    save: jest.Mock;
  };

  let catalogosService: {
    existeClaveActiva: jest.Mock;
  };

  const crearDto = (actividades: string[]) => ({
    nombre: 'Ruta de prueba ADM-11',
    actividades,
    dificultad: 'moderada',
    distanciaKm: 5,
    puntos: [
      { lat: 9.93, lng: -84.09 },
      { lat: 9.94, lng: -84.1 },
    ],
    visibilidad: 'privada',
  });

  beforeEach(() => {
    rutas = {
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => ({
        id: 10,
        ...datos,
      })),
    };

    catalogosService = {
      existeClaveActiva: jest.fn().mockResolvedValue(true),
    };

    // CatalogosService es la ultima dependencia del constructor.
    // Las dependencias intermedias no participan en create.
    service = new (
      RutaService as unknown as new (
        rutas: unknown,
        favoritos: unknown,
        insignias: unknown,
        notificaciones: unknown,
        catalogos: CatalogosService,
      ) => RutaService
    )(
      rutas,
      undefined,
{ evaluar: jest.fn().mockResolvedValue([]) },
{ crear: jest.fn().mockResolvedValue({}) },
catalogosService as unknown as CatalogosService,
    );
  });

  it('acepta una actividad dinamica activa', async () => {
    const actividad = 'trail_running_adm11';

    await service.create(
      crearDto([actividad]) as Parameters<RutaService['create']>[0],
      DUENO,
    );

    expect(
      catalogosService.existeClaveActiva,
    ).toHaveBeenCalledWith('actividades', actividad);

    expect(rutas.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actividades: [actividad],
      }),
    );
  });

  it('rechaza una actividad inexistente o inactiva', async () => {
    catalogosService.existeClaveActiva.mockResolvedValueOnce(false);

    await expect(
      service.create(
        crearDto(['actividad_inactiva']) as Parameters<
          RutaService['create']
        >[0],
        DUENO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      catalogosService.existeClaveActiva,
    ).toHaveBeenCalledWith(
      'actividades',
      'actividad_inactiva',
    );

    expect(rutas.create).not.toHaveBeenCalled();
    expect(rutas.save).not.toHaveBeenCalled();
  });

  it('valida todas las actividades antes de guardar', async () => {
    catalogosService.existeClaveActiva
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(
      service.create(
        crearDto([
          ActividadRuta.Running,
          'actividad_inactiva',
        ]) as Parameters<RutaService['create']>[0],
        DUENO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      catalogosService.existeClaveActiva,
    ).toHaveBeenCalledTimes(2);

    expect(rutas.save).not.toHaveBeenCalled();
  });
});


describe('RutaService.registrarRecorrido (POST /rutas/:id/recorridos)', () => {
  let service: RutaService;
  let rutas: { findOne: jest.Mock };
  let recorridos: { create: jest.Mock; save: jest.Mock };
  let insignias: { evaluar: jest.Mock };

  beforeEach(() => {
    rutas = { findOne: jest.fn() };
    recorridos = {
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 1, ...dto })),
    };
    insignias = { evaluar: jest.fn().mockResolvedValue(undefined) };

    service = new RutaService(
      rutas as any,
      {} as any,
      insignias as any,
      {} as any,
      {} as any,
      recorridos as any,
    );
  });

  it('404 si la ruta no existe', async () => {
    rutas.findOne.mockResolvedValue(null);
    await expect(
      service.registrarRecorrido(5, 7, {
        distanciaKm: 4.2,
        duracionSegundos: 1200,
        iniciadoEn: new Date().toISOString(),
        finalizadoEn: new Date().toISOString(),
        puntos: [{ lat: 10, lng: -85 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('guarda el recorrido y evalua insignias', async () => {
    rutas.findOne.mockResolvedValue(ruta(EstadoRuta.Publicada));
    const res = await service.registrarRecorrido(5, 7, {
      distanciaKm: 4.2,
      duracionSegundos: 1200,
      iniciadoEn: new Date().toISOString(),
      finalizadoEn: new Date().toISOString(),
      puntos: [{ lat: 10, lng: -85 }],
    });

    expect(recorridos.create).toHaveBeenCalled();
    expect(recorridos.save).toHaveBeenCalled();
    expect(insignias.evaluar).toHaveBeenCalledWith(7);
    expect(res.distanciaKm).toBe(4.2);
  });
});
