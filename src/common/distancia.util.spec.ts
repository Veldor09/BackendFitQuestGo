import { distanciaMetros } from './distancia.util';

describe('distanciaMetros', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(distanciaMetros(9.9281, -84.0907, 9.9281, -84.0907)).toBe(0);
  });

  it('un grado de latitud son ~111.2 km', () => {
    const d = distanciaMetros(0, 0, 1, 0);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('0.0009 grados de latitud son ~100 m', () => {
    const d = distanciaMetros(9.9281, -84.0907, 9.9281 + 0.0009, -84.0907);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });

  it('es simetrica', () => {
    const ida = distanciaMetros(9.93, -84.08, 9.94, -84.09);
    const vuelta = distanciaMetros(9.94, -84.09, 9.93, -84.08);
    expect(ida).toBeCloseTo(vuelta, 6);
  });

  it('la longitud se acorta con la latitud (coseno)', () => {
    const ecuador = distanciaMetros(0, 0, 0, 0.001);
    const costaRica = distanciaMetros(10, 0, 10, 0.001);
    expect(costaRica).toBeLessThan(ecuador);
  });
});
