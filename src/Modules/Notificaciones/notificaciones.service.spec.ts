import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaNotificacion, ReferenciaTipoNotificacion } from './notificacion.enum';
import { Notificacion } from './notificacion.entity';
import { NotificacionesService } from './notificaciones.service';
import { TipoPush } from './push/push-plantillas';
import { PushService } from './push/push.service';

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

  it('yaAvisada es verdadera si ya hay una notificacion con ese usuario, referencia y titulo', async () => {
    repo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(
      service.yaAvisada(5, ReferenciaTipoNotificacion.Suscripcion, 9, 'Tu plan vence'),
    ).resolves.toBe(true);
    expect(repo.count).toHaveBeenCalledWith({
      where: {
        idUsuario: 5,
        referenciaTipo: ReferenciaTipoNotificacion.Suscripcion,
        referenciaId: 9,
        titulo: 'Tu plan vence',
      },
    });
    await expect(
      service.yaAvisada(5, ReferenciaTipoNotificacion.Suscripcion, 9, 'Otro'),
    ).resolves.toBe(false);
  });

  it('debe arrojar NotFoundException si un usuario intenta borrar una notificación ajena o inexistente', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1, 99)).rejects.toThrow(NotFoundException);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});

describe('NotificacionesService — avisos fuera de la app', () => {
  const base = {
    idUsuario: 5,
    categoria: CategoriaNotificacion.Rutas,
    titulo: 'Titulo',
    mensaje: 'Mensaje',
  };
  const guardada = { id: 77, ...base, referenciaTipo: null, referenciaId: null };
  let repo: { create: jest.Mock; save: jest.Mock };
  let push: { notificar: jest.Mock };
  let service: NotificacionesService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockImplementation((x: unknown) => x),
      save: jest.fn().mockResolvedValue(guardada),
    };
    push = { notificar: jest.fn().mockResolvedValue(undefined) };
    service = new NotificacionesService(
      repo as unknown as Repository<Notificacion>,
      push as unknown as PushService,
    );
  });

  it('sin `push` la notificacion solo queda en la campana: nada sale del telefono', async () => {
    await service.crear(base);
    expect(push.notificar).not.toHaveBeenCalled();
  });

  it('con `push` se manda el aviso con la notificacion ya guardada', async () => {
    const solicitud = { tipo: TipoPush.RutaAprobada, params: { nombre: 'X' } };
    await service.crear({ ...base, push: solicitud });
    expect(push.notificar).toHaveBeenCalledWith(guardada, solicitud);
  });

  it('si el aviso fuera de la app falla (rechaza), crear igual devuelve la notificacion', async () => {
    push.notificar.mockRejectedValue(new Error('FCM caido'));
    await expect(
      service.crear({ ...base, push: { tipo: TipoPush.AlertaResuelta } }),
    ).resolves.toBe(guardada);
  });

  it('si no se pudo guardar no se manda ningun aviso', async () => {
    repo.save.mockRejectedValue(new Error('db'));
    await expect(
      service.crear({ ...base, push: { tipo: TipoPush.AlertaResuelta } }),
    ).resolves.toBeNull();
    expect(push.notificar).not.toHaveBeenCalled();
  });

  it('sin PushService (modulo sin Firebase) crear funciona igual', async () => {
    const sinPush = new NotificacionesService(repo as unknown as Repository<Notificacion>);
    await expect(
      sinPush.crear({ ...base, push: { tipo: TipoPush.AlertaResuelta } }),
    ).resolves.toBe(guardada);
  });
});
