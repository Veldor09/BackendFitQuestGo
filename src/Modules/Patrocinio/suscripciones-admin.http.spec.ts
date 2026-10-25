
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import request from 'supertest';

import { AuthConfig } from '../Auth/auth.config';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { RoleId } from '../Usuarios/roles.enum';

import { SuscripcionesAdminController } from './suscripciones-admin.controller';
import { SuscripcionesService } from './suscripciones.service';

describe('SuscripcionesAdminController - Seguridad HTTP', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const secretoPruebas = 'secreto-exclusivo-para-pruebas-http';

  const suscripcionesServiceMock = {
    aprobarSuscripcion: jest.fn(),
    rechazarSuscripcion: jest.fn(),
  };

  const rutaAprobar =
    '/admin/patrocinio/suscripciones/25/aprobar';

  const rutaRechazar =
    '/admin/patrocinio/suscripciones/25/rechazar';

  const motivoValido =
    'La solicitud no cumple con los requisitos de patrocinio';

  const crearTokenAdministrador = async () =>
    jwtService.signAsync({
      sub: 3,
      email: 'admin@fitquestgo.com',
      rol: RoleId.Admin,
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [SuscripcionesAdminController],
        providers: [
          {
            provide: SuscripcionesService,
            useValue: suscripcionesServiceMock,
          },
          {
            provide: JwtService,
            useValue: new JwtService({
              secret: secretoPruebas,
            }),
          },
          {
            provide: AuthConfig,
            useValue: {
              secretoAccessToken: secretoPruebas,
            },
          },
          Reflector,
          GuardiaJwt,
          GuardiaRoles,
        ],
      }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  // PRUEBAS HTTP DE APROBACION

  it('debe responder 401 cuando no se envia token', async () => {
    await request(app.getHttpServer())
      .patch(rutaAprobar)
      .expect(401);

    expect(
      suscripcionesServiceMock.aprobarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 401 cuando el token es invalido', async () => {
    await request(app.getHttpServer())
      .patch(rutaAprobar)
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    expect(
      suscripcionesServiceMock.aprobarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 403 cuando el usuario no es administrador', async () => {
    const token = await jwtService.signAsync({
      sub: 15,
      email: 'usuario@fitquestgo.com',
      rol: -1,
    });

    await request(app.getHttpServer())
      .patch(rutaAprobar)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(
      suscripcionesServiceMock.aprobarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe permitir la aprobacion a un administrador autenticado', async () => {
    const administradorId = 3;
    const token = await crearTokenAdministrador();

    const resultadoEsperado = {
      id: 25,
      estado: 'Activa',
      administradorId,
    };

    suscripcionesServiceMock.aprobarSuscripcion.mockResolvedValue(
      resultadoEsperado,
    );

    const respuesta = await request(app.getHttpServer())
      .patch(rutaAprobar)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body).toEqual(resultadoEsperado);

    expect(
      suscripcionesServiceMock.aprobarSuscripcion,
    ).toHaveBeenCalledWith(25, administradorId);
  });

  it('debe responder 400 cuando el ID no es numerico', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch('/admin/patrocinio/suscripciones/abc/aprobar')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(
      suscripcionesServiceMock.aprobarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  // PRUEBAS HTTP DE RECHAZO

  it('debe responder 401 al rechazar sin token', async () => {
    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .send({ motivo: motivoValido })
      .expect(401);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 401 al rechazar con token invalido', async () => {
    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', 'Bearer token-invalido')
      .send({ motivo: motivoValido })
      .expect(401);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 403 si un usuario no administrador intenta rechazar', async () => {
    const token = await jwtService.signAsync({
      sub: 15,
      email: 'usuario@fitquestgo.com',
      rol: -1,
    });

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: motivoValido })
      .expect(403);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe permitir rechazar a un administrador autenticado', async () => {
    const token = await crearTokenAdministrador();

    const resultadoEsperado = {
      id: 25,
      estado: 'Rechazada',
      administradorId: 3,
      motivo: motivoValido,
    };

    suscripcionesServiceMock.rechazarSuscripcion.mockResolvedValue(
      resultadoEsperado,
    );

    const respuesta = await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: motivoValido })
      .expect(200);

    expect(respuesta.body).toEqual(resultadoEsperado);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).toHaveBeenCalledWith(
      25,
      3,
      expect.objectContaining({
        motivo: motivoValido,
      }),
    );
  });

  it('debe responder 400 al rechazar con ID no numerico', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch('/admin/patrocinio/suscripciones/abc/rechazar')
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: motivoValido })
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 400 cuando falta el motivo', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 400 cuando el motivo es demasiado corto', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'No cumple' })
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 400 cuando el motivo solo contiene espacios', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: '               ' })
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 400 cuando el motivo supera 500 caracteres', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'A'.repeat(501) })
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });

  it('debe responder 400 cuando se envian propiedades adicionales', async () => {
    const token = await crearTokenAdministrador();

    await request(app.getHttpServer())
      .patch(rutaRechazar)
      .set('Authorization', `Bearer ${token}`)
      .send({
        motivo: motivoValido,
        estado: 'Activa',
      })
      .expect(400);

    expect(
      suscripcionesServiceMock.rechazarSuscripcion,
    ).not.toHaveBeenCalled();
  });
});
