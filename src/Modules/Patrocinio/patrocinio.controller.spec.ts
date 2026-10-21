import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { DestacarDto } from './dto/destacar.dto';
import { PatrocinioController } from './patrocinio.controller';

describe('PatrocinioController — moneda por pais', () => {
  const controlador = new PatrocinioController();

  it('responde la moneda del pais, sin importar mayusculas', () => {
    expect(controlador.moneda('cr')).toEqual({
      pais: 'CR',
      moneda: 'CRC',
      simbolo: '₡',
      decimales: 0,
    });
    expect(controlador.moneda('es')).toEqual({
      pais: 'ES',
      moneda: 'EUR',
      simbolo: '€',
      decimales: 2,
    });
  });

  it('sin pais responde dolares y pais nulo', () => {
    expect(controlador.moneda(undefined)).toEqual({
      pais: null,
      moneda: 'USD',
      simbolo: 'US$',
      decimales: 2,
    });
  });

  it('exige iniciar sesion', () => {
    const guardias = Reflect.getMetadata('__guards__', PatrocinioController) as
      unknown[] | undefined;
    expect(guardias).toContain(GuardiaJwt);
  });
});

describe('DestacarDto', () => {
  it('exige un booleano', async () => {
    expect(
      await validate(plainToInstance(DestacarDto, { destacar: 'si' })),
    ).not.toHaveLength(0);
    expect(await validate(plainToInstance(DestacarDto, {}))).not.toHaveLength(
      0,
    );
    expect(
      await validate(plainToInstance(DestacarDto, { destacar: false })),
    ).toHaveLength(0);
  });
});
