import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsigniasService } from './insignias.service';
import { Insignia } from './insignia.entity';
import { UsuarioInsignia } from './usuario-insignia.entity';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CodigoInsignia, TipoInsignia } from './insignia.enum';

describe('InsigniasService', () => {
  let service: InsigniasService;
  let insigniaRepo: jest.Mocked<Repository<Insignia>>;
  let usuarioInsigniaRepo: jest.Mocked<Repository<UsuarioInsignia>>;
  let notificacionesService: jest.Mocked<NotificacionesService>;

  beforeEach(async () => {
    const mockInsigniaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      manager: {
        query: jest.fn(),
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
  });

  it('debe otorgar una insignia y enviar notificación si el usuario no la tiene', async () => {
    const mockInsignia: Insignia = {
      id: 1,
      codigo: CodigoInsignia.PrimeraRuta,
      nombre: 'Primera ruta',
      descripcion: 'Crea tu primera ruta',
      emoji: '🥾',
      tipo: TipoInsignia.Hito,
      meta: 1,
      activa: true,
      usuariosInsignias: [],
    };

    insigniaRepo.findOne.mockResolvedValue(mockInsignia);
    usuarioInsigniaRepo.findOne.mockResolvedValue(null);
    usuarioInsigniaRepo.create.mockReturnValue({
      id: 1,
      idUsuario: 10,
      idInsignia: 1,
      obtenidaEn: new Date(),
    } as UsuarioInsignia);
    usuarioInsigniaRepo.save.mockResolvedValue({} as any);

    const otorgada = await service.otorgar(10, CodigoInsignia.PrimeraRuta);

    expect(otorgada).toBe(true);
    expect(usuarioInsigniaRepo.save).toHaveBeenCalled();
    expect(notificacionesService.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 10,
        referenciaId: 1,
      }),
    );
  });

  it('debe ser idempotente y no otorgar ni notificar si ya la tiene', async () => {
    const mockInsignia: Insignia = {
      id: 1,
      codigo: CodigoInsignia.PrimeraRuta,
      nombre: 'Primera ruta',
      descripcion: 'Crea tu primera ruta',
      emoji: '🥾',
      tipo: TipoInsignia.Hito,
      meta: 1,
      activa: true,
      usuariosInsignias: [],
    };

    insigniaRepo.findOne.mockResolvedValue(mockInsignia);
    usuarioInsigniaRepo.findOne.mockResolvedValue({
      id: 5,
      idUsuario: 10,
      idInsignia: 1,
    } as UsuarioInsignia);

    const otorgada = await service.otorgar(10, CodigoInsignia.PrimeraRuta);

    expect(otorgada).toBe(false);
    expect(usuarioInsigniaRepo.save).not.toHaveBeenCalled();
    expect(notificacionesService.crear).not.toHaveBeenCalled();
  });
});
