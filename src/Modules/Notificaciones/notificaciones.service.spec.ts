import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaNotificacion, ReferenciaTipoNotificacion } from './notificacion.enum';
import { Notificacion } from './notificacion.entity';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let repo: jest.Mocked<Repository<Notificacion>>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: getRepositoryToken(Notificacion),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<NotificacionesService>(NotificacionesService);
    repo = module.get(getRepositoryToken(Notificacion));
  });

  it('debe marcar una notificación como leída si pertenece al usuario', async () => {
    const notif = {
      id: 1,
      idUsuario: 5,
      categoria: CategoriaNotificacion.Rutas,
      titulo: 'Test',
      mensaje: 'Test mensaje',
      leida: false,
      creadaEn: new Date(),
      referenciaTipo: ReferenciaTipoNotificacion.Ruta,
      referenciaId: 10,
    } as Notificacion;

    repo.findOne.mockResolvedValue(notif);
    repo.save.mockResolvedValue({ ...notif, leida: true });

    const res = await service.marcarLeida(1, 5);

    expect(res.leida).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it('debe arrojar NotFoundException si un usuario intenta leer una notificación ajena o inexistente', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.marcarLeida(1, 99)).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('debe arrojar NotFoundException si un usuario intenta borrar una notificación ajena o inexistente', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1, 99)).rejects.toThrow(NotFoundException);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
