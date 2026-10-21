import { monedaParaPais, PAISES_ZONA_EURO } from './monedas';

describe('monedaParaPais — el pais de facturacion decide la moneda del cobro', () => {
  it('Costa Rica paga en colones, sin importar mayusculas ni espacios', () => {
    expect(monedaParaPais('CR')).toBe('CRC');
    expect(monedaParaPais(' cr ')).toBe('CRC');
  });

  it('la zona euro (21 paises, Bulgaria desde 2026) paga en euros', () => {
    expect(PAISES_ZONA_EURO).toEqual([
      'AT',
      'BE',
      'BG',
      'CY',
      'DE',
      'EE',
      'ES',
      'FI',
      'FR',
      'GR',
      'HR',
      'IE',
      'IT',
      'LT',
      'LU',
      'LV',
      'MT',
      'NL',
      'PT',
      'SI',
      'SK',
    ]);
    for (const pais of PAISES_ZONA_EURO) {
      expect(monedaParaPais(pais)).toBe('EUR');
    }
    expect(monedaParaPais(' de ')).toBe('EUR');
  });

  it('el resto del mundo, y lo vacio o desconocido, paga en dolares', () => {
    for (const pais of ['US', 'MX', 'BR', 'XX', '', null, undefined]) {
      expect(monedaParaPais(pais)).toBe('USD');
    }
  });
});
