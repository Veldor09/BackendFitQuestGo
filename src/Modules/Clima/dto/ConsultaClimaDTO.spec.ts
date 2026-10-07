import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultaClimaDto } from './ConsultaClimaDTO';

const consulta = (datos: Record<string, unknown>) =>
  plainToInstance(ConsultaClimaDto, datos);

const camposConError = async (c: ConsultaClimaDto) =>
  (await validate(c)).map((e) => e.property);

describe('ConsultaClimaDto — posicion que llega por query string', () => {
  it('acepta lat y lng como texto y las convierte en numeros', async () => {
    const c = consulta({ lat: '9.93', lng: '-84.09' });
    expect(await camposConError(c)).toEqual([]);
    expect(c.lat).toBe(9.93);
    expect(c.lng).toBe(-84.09);
  });

  it('acepta tambien numeros', async () => {
    expect(await camposConError(consulta({ lat: 9.93, lng: -84.09 }))).toEqual(
      [],
    );
  });

  it.each([
    [{ lng: '-84.09' }, 'lat'],
    [{ lat: '9.93' }, 'lng'],
  ])('rechaza si falta un campo %j (%s)', async (datos, campo) => {
    expect(await camposConError(consulta(datos))).toContain(campo);
  });

  it.each([
    [{ lat: '', lng: '-84.09' }, 'lat'],
    [{ lat: '9.93', lng: '' }, 'lng'],
  ])('un campo vacio no cuenta como 0 %j (%s)', async (datos, campo) => {
    expect(await camposConError(consulta(datos))).toContain(campo);
  });

  it.each([
    [{ lat: '91', lng: '-84.09' }, 'lat'],
    [{ lat: '-91', lng: '-84.09' }, 'lat'],
    [{ lat: '9.93', lng: '181' }, 'lng'],
    [{ lat: '9.93', lng: '-181' }, 'lng'],
    [{ lat: 'abc', lng: '-84.09' }, 'lat'],
    [{ lat: '9.93', lng: 'norte' }, 'lng'],
  ])('rechaza fuera de rango o no numerico %j (%s)', async (datos, campo) => {
    expect(await camposConError(consulta(datos))).toContain(campo);
  });
});
