import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { ClimaController } from './clima.controller';
import { ClimaService, RespuestaClima } from './clima.service';

describe('ClimaController', () => {
  const respuesta: RespuestaClima = {
    alertas: [],
    fuente: 'Open-Meteo',
    actualizadoEn: '2026-10-06T12:00:00.000Z',
  };
  let servicio: {
    alertas: jest.Mock<Promise<RespuestaClima>, [number, number]>;
  };
  let controlador: ClimaController;

  beforeEach(async () => {
    servicio = {
      alertas: jest
        .fn<Promise<RespuestaClima>, [number, number]>()
        .mockResolvedValue(respuesta),
    };
    const modulo = await Test.createTestingModule({
      controllers: [ClimaController],
      providers: [{ provide: ClimaService, useValue: servicio }],
    })
      .overrideGuard(GuardiaJwt)
      .useValue({ canActivate: () => true })
      .compile();
    controlador = modulo.get(ClimaController);
  });

  it('pide las alertas de la zona recibida y las devuelve', async () => {
    await expect(controlador.alertas({ lat: 9.93, lng: -84.09 })).resolves.toBe(
      respuesta,
    );
    expect(servicio.alertas).toHaveBeenCalledWith(9.93, -84.09);
  });

  it('exige iniciar sesion (no es publico)', () => {
    const guardias = Reflect.getMetadata('__guards__', ClimaController) as
      unknown[] | undefined;
    expect(guardias).toContain(GuardiaJwt);
  });
});
