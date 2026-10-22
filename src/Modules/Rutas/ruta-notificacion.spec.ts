import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleId } from '../Usuarios/roles.enum';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogosService } from '../Catalogos/catalogos.service';
import { InsigniasService } from '../Insignias/insignias.service';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { ActividadRuta } from './actividad-ruta.enum';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

describe('RutaService - Notificaciones y Moderación', () => {
  let service: RutaService;
  let rutaRepo: jest.Mocked<Repository<Ruta>>;
  let notificacionesService: jest.Mocked<NotificacionesService>;
  let insigniasService: jest.Mocked<InsigniasService>;
  let catalogosService: jest.Mocked<CatalogosService>;

  beforeEach(async () => {
    const mockRutaRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const mockFavoritaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockNotificacionesService = {
      crear: jest.fn().mockResolvedValue({}),
    };

    const mockInsigniasService = {
      evaluar: jest.fn().mockResolvedValue([]),
    };

    const mockCatalogosService = {
      existeClaveActiva: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RutaService,
        {
          provide: getRepositoryToken(Ruta),
          useValue: mockRutaRepo,
        },
        {
          provide: getRepositoryToken(RutaFavorita),
          useValue: mockFavoritaRepo,
        },
        {
          provide: NotificacionesService,
          useValue: mockNotificacionesService,
        },
        {
          provide: InsigniasService,
          useValue: mockInsigniasService,
        },
        {
          provide: CatalogosService,
          useValue: mockCatalogosService,
        },
      ],
    }).compile();

    service = module.get<RutaService>(RutaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    notificacionesService = module.get(NotificacionesService);
    insigniasService = module.get(InsigniasService);
    catalogosService = module.get(CatalogosService);
  });

  it('un admin ya no aprueba rutas: las rutas se publican solas', async () => {
    const rutaExistente = {
      id: 15,
      nombre: 'Cerro Grande',
      estado: EstadoRuta.Pendiente,
      creadoPor: {
        id: 7,
        nombreUser: 'Juan',
      },
    } as Ruta;

    rutaRepo.findOne.mockResolvedValue(rutaExistente);

    await expect(
      service.cambiarEstado(15, EstadoRuta.Publicada),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(rutaRepo.save).not.toHaveBeenCalled();
    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });

  it('debe notificar al autor cuando una ruta es rechazada', async () => {
    const rutaExistente = {
      id: 20,
      nombre: 'Ruta Insegura',
      estado: EstadoRuta.Pendiente,
      creadoPor: {
        id: 7,
        nombreUser: 'Juan',
      },
    } as Ruta;

    rutaRepo.findOne.mockResolvedValue(rutaExistente);
    rutaRepo.save.mockImplementation(async (r) => r);

    await service.cambiarEstado(
      20,
      EstadoRuta.Rechazada,
    );

    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        categoria: CategoriaNotificacion.Rutas,
        titulo: 'Tu ruta "Ruta Insegura" no fue aprobada',
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: 20,
      }),
    );
  });

  it('debe notificar al autor cuando crea una ruta privada', async () => {
    const rutaCreada = {
      id: 30,
      nombre: 'Paseo por el parque',
      estado: EstadoRuta.Privada,
      visibilidad: 'privada',
      actividades: [ActividadRuta.Running],
      creadoPor: { id: 7 },
    } as Ruta;

    rutaRepo.create.mockReturnValue(rutaCreada);
    rutaRepo.save.mockResolvedValue(rutaCreada);

    await service.create(
      {
        nombre: 'Paseo por el parque',
        actividades: [ActividadRuta.Running],
        dificultad: 'facil',
        distanciaKm: 5,
        puntos: [],
        visibilidad: 'privada',
      },
      7,
    );

    expect(catalogosService.existeClaveActiva).toHaveBeenCalledWith(
      'actividades',
      ActividadRuta.Running,
    );

    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        categoria: CategoriaNotificacion.Rutas,
        titulo: 'Ruta creada con éxito',
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: 30,
      }),
    );

    expect(insigniasService.evaluar).toHaveBeenCalled();
  });

  it('una ruta pública se publica de inmediato y se lo avisa al autor', async () => {
    const rutaCreada = {
      id: 31,
      nombre: 'Sendero del Volcán',
      estado: EstadoRuta.Publicada,
      visibilidad: 'publica',
      actividades: [ActividadRuta.Running],
      creadoPor: { id: 7 },
    } as Ruta;

    rutaRepo.create.mockReturnValue(rutaCreada);
    rutaRepo.save.mockResolvedValue(rutaCreada);

    await service.create(
      {
        nombre: 'Sendero del Volcán',
        actividades: [ActividadRuta.Running],
        dificultad: 'dificil',
        distanciaKm: 12,
        puntos: [],
        visibilidad: 'publica',
      },
      7,
    );

    expect(catalogosService.existeClaveActiva).toHaveBeenCalledWith(
      'actividades',
      ActividadRuta.Running,
    );

    expect(rutaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoRuta.Publicada,
        visibilidad: 'publica',
      }),
    );

    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        categoria: CategoriaNotificacion.Rutas,
        titulo: 'Ruta publicada',
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: 31,
      }),
    );

    expect(insigniasService.evaluar).toHaveBeenCalled();
  });

  it('publicar una ruta privada la deja publicada al instante y avisa', async () => {
    const rutaExistente = {
      id: 32,
      nombre: 'Ruta de Entrenamiento',
      estado: EstadoRuta.Privada,
      creadoPor: {
        id: 7,
        nombreUser: 'Juan',
      },
    } as Ruta;

    rutaRepo.findOne.mockResolvedValue(rutaExistente);
    rutaRepo.save.mockImplementation(async (r) => r);

    await service.solicitarPublicacion(32, 7);

    expect(rutaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoRuta.Publicada,
        visibilidad: 'publica',
      }),
    );
    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        categoria: CategoriaNotificacion.Rutas,
        titulo: 'Ruta publicada',
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: 32,
      }),
    );
  });

  it('la visibilidad "amigos" ya no existe: lo que no es publico queda privado', async () => {
    const rutaCreada = { id: 40, nombre: 'X', creadoPor: { id: 7 } } as Ruta;
    rutaRepo.create.mockReturnValue(rutaCreada);
    rutaRepo.save.mockResolvedValue(rutaCreada);

    await service.create(
      {
        nombre: 'X',
        actividades: [ActividadRuta.Running],
        distanciaKm: 1,
        puntos: [],
        visibilidad: 'amigos',
      },
      7,
    );

    expect(rutaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoRuta.Privada,
        visibilidad: 'privada',
      }),
    );
  });

  it('solo se publica una ruta privada', async () => {
    rutaRepo.findOne.mockResolvedValue({
      id: 33,
      estado: EstadoRuta.Publicada,
      creadoPor: { id: 7 },
    } as Ruta);

    await expect(service.solicitarPublicacion(33, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  describe('eliminar', () => {
    const ruta = { id: 50, nombre: 'Mia', creadoPor: { id: 7 } } as Ruta;
    const DUENO = { id: 7, email: 'a@x.co', rol: RoleId.UserNormal };
    const OTRO = { id: 9, email: 'b@x.co', rol: RoleId.UserNormal };
    const ADMIN = { id: 1, email: 'adm@x.co', rol: RoleId.Admin };

    it('el dueño elimina su ruta', async () => {
      rutaRepo.findOne.mockResolvedValue(ruta);

      await service.eliminar(50, DUENO);

      expect(rutaRepo.remove).toHaveBeenCalledWith(ruta);
    });

    it('un admin tambien puede', async () => {
      rutaRepo.findOne.mockResolvedValue(ruta);

      await service.eliminar(50, ADMIN);

      expect(rutaRepo.remove).toHaveBeenCalledTimes(1);
    });

    it('403 si la ruta es de otra persona', async () => {
      rutaRepo.findOne.mockResolvedValue(ruta);

      await expect(service.eliminar(50, OTRO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(rutaRepo.remove).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      rutaRepo.findOne.mockResolvedValue(null);

      await expect(service.eliminar(50, DUENO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
