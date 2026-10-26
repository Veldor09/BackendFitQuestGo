
import { Test, TestingModule } from '@nestjs/testing';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';

import { SuscripcionesAdminController } from './suscripciones-admin.controller';
import { SuscripcionesService } from './suscripciones.service';

describe('SuscripcionesAdminController', () => {
  let controller: SuscripcionesAdminController;

  const suscripcionesServiceMock = {
    aprobarSuscripcion: jest.fn(),
    rechazarSuscripcion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuscripcionesAdminController],
      providers: [
        {
          provide: SuscripcionesService,
          useValue: suscripcionesServiceMock,
        },
      ],
    })
      .overrideGuard(GuardiaJwt)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(GuardiaRoles)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<SuscripcionesAdminController>(
      SuscripcionesAdminController,
    );
  });

  it('debe crear el controlador', () => {
    expect(controller).toBeDefined();
  });

  it('debe aprobar una suscripcion usando el ID del administrador autenticado', async () => {
    const suscripcionId = 25;

    const administrador = {
      id: 3,
      email: 'admin@fitquestgo.com',
      rol: 3,
    } as UsuarioAutenticado;

    const resultadoEsperado = {
      id: suscripcionId,
      estado: 'Activa',
      administradorId: administrador.id,
    };

    suscripcionesServiceMock.aprobarSuscripcion.mockResolvedValue(
      resultadoEsperado,
    );

    const resultado = await controller.aprobarSuscripcion(
      suscripcionId,
      administrador,
    );

    expect(suscripcionesServiceMock.aprobarSuscripcion).toHaveBeenCalledTimes(
      1,
    );

    expect(suscripcionesServiceMock.aprobarSuscripcion).toHaveBeenCalledWith(
      suscripcionId,
      administrador.id,
    );

    expect(resultado).toEqual(resultadoEsperado);
  });

  it('debe propagar los errores del servicio', async () => {
    const administrador = {
      id: 3,
      email: 'admin@fitquestgo.com',
      rol: 3,
    } as UsuarioAutenticado;

    const error = new Error('La suscripcion no puede aprobarse');

    suscripcionesServiceMock.aprobarSuscripcion.mockRejectedValue(error);

    await expect(
      controller.aprobarSuscripcion(25, administrador),
    ).rejects.toThrow('La suscripcion no puede aprobarse');

    expect(suscripcionesServiceMock.aprobarSuscripcion).toHaveBeenCalledWith(
      25,
      administrador.id,
    );
  });

  it('debe rechazar una suscripcion usando el ID del administrador autenticado', async () => {
    const suscripcionId = 25;

    const administrador = {
      id: 3,
      email: 'admin@fitquestgo.com',
      rol: 3,
    } as UsuarioAutenticado;

    const dto = {
      motivo: 'La solicitud no cumple con los requisitos de patrocinio',
    };

    const resultadoEsperado = {
      id: suscripcionId,
      estado: 'Rechazada',
      administradorId: administrador.id,
      motivo: dto.motivo,
    };

    suscripcionesServiceMock.rechazarSuscripcion.mockResolvedValue(
      resultadoEsperado,
    );

    const resultado = await controller.rechazarSuscripcion(
      suscripcionId,
      administrador,
      dto,
    );

    expect(suscripcionesServiceMock.rechazarSuscripcion).toHaveBeenCalledTimes(
      1,
    );

    expect(suscripcionesServiceMock.rechazarSuscripcion).toHaveBeenCalledWith(
      suscripcionId,
      administrador.id,
      dto,
    );

    expect(resultado).toEqual(resultadoEsperado);
  });

  it('debe transmitir el motivo del rechazo al servicio', async () => {
    const administrador = {
      id: 3,
      email: 'admin@fitquestgo.com',
      rol: 3,
    } as UsuarioAutenticado;

    const dto = {
      motivo: 'La documentacion presentada es insuficiente',
    };

    suscripcionesServiceMock.rechazarSuscripcion.mockResolvedValue({
      id: 30,
      estado: 'Rechazada',
      motivo: dto.motivo,
    });

    await controller.rechazarSuscripcion(
      30,
      administrador,
      dto,
    );

    expect(suscripcionesServiceMock.rechazarSuscripcion).toHaveBeenCalledWith(
      30,
      3,
      expect.objectContaining({
        motivo: 'La documentacion presentada es insuficiente',
      }),
    );
  });

  it('debe propagar los errores del servicio al rechazar', async () => {
    const administrador = {
      id: 3,
      email: 'admin@fitquestgo.com',
      rol: 3,
    } as UsuarioAutenticado;

    const dto = {
      motivo: 'La solicitud ya fue procesada anteriormente',
    };

    const error = new Error('La suscripcion no puede rechazarse');

    suscripcionesServiceMock.rechazarSuscripcion.mockRejectedValue(error);

    await expect(
      controller.rechazarSuscripcion(
        25,
        administrador,
        dto,
      ),
    ).rejects.toThrow('La suscripcion no puede rechazarse');

    expect(suscripcionesServiceMock.rechazarSuscripcion).toHaveBeenCalledWith(
      25,
      administrador.id,
      dto,
    );
  });
});
