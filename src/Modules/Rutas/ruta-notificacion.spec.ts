import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsigniasService } from '../Insignias/insignias.service';
import { CategoriaNotificacion, ReferenciaTipoNotificacion } from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

describe('RutaService - Notificaciones y Moderación', () => {
  let service: RutaService;
  let rutaRepo: jest.Mocked<Repository<Ruta>>;
  let notificacionesService: jest.Mocked<NotificacionesService>;
  let insigniasService: jest.Mocked<InsigniasService>;

  beforeEach(async () => {
    const mockRutaRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    };

    const mockFavoritaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockNotificacionesService = {
      crear: jest.fn(),
    };

    const mockInsigniasService = {
      evaluar: jest.fn(),
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
      ],
    }).compile();

    service = module.get<RutaService>(RutaService);
    rutaRepo = module.get(getRepositoryToken(Ruta));
    notificacionesService = module.get(NotificacionesService);
    insigniasService = module.get(InsigniasService);
  });

  it('debe notificar al autor cuando una ruta es aprobada (Publicada)', async () => {
    const rutaExistente = {
      id: 15,
      nombre: 'Cerro Grande',
      estado: EstadoRuta.Pendiente,
      creadoPor: { id: 7, nombreUser: 'Juan' },
    } as any;

    rutaRepo.findOne.mockResolvedValue(rutaExistente);
    rutaRepo.save.mockImplementation(async (r: any) => r);

    await service.cambiarEstado(15, EstadoRuta.Publicada);

    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        categoria: CategoriaNotificacion.Rutas,
        titulo: '¡Tu ruta "Cerro Grande" fue aprobada!',
        referenciaTipo: ReferenciaTipoNotificacion.Ruta,
        referenciaId: 15,
      }),
    );
  });

  it('debe notificar al autor cuando una ruta es rechazada', async () => {
    const rutaExistente = {
      id: 20,
      nombre: 'Ruta Insegura',
      estado: EstadoRuta.Pendiente,
      creadoPor: { id: 7, nombreUser: 'Juan' },
    } as any;

    rutaRepo.findOne.mockResolvedValue(rutaExistente);
    rutaRepo.save.mockImplementation(async (r: any) => r);

    await service.cambiarEstado(20, EstadoRuta.Rechazada);

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
});
