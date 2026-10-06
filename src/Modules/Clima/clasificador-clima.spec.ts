import { clasificarPronostico } from './clasificador-clima';
import {
  AlertaClima,
  HoraPronostico,
  NivelAlertaClima,
  TipoAlertaClima,
} from './clima.tipos';

/** Una hora de tiempo tranquilo, con lo que se quiera cambiar encima. */
const hora = (cambios: Partial<HoraPronostico> = {}): HoraPronostico => ({
  precipitacionMmH: 0,
  sensacionC: 22,
  codigoWmo: 3,
  ...cambios,
});

const tranquilas = (cantidad = 4): HoraPronostico[] =>
  Array.from({ length: cantidad }, () => hora());

const soloTipo = (alertas: AlertaClima[], tipo: TipoAlertaClima) =>
  alertas.filter((a) => a.tipo === tipo);

describe('clasificarPronostico', () => {
  it('sin horas no hay alertas', () => {
    expect(clasificarPronostico([])).toEqual([]);
  });

  it('con tiempo tranquilo no hay alertas', () => {
    expect(clasificarPronostico(tranquilas())).toEqual([]);
  });

  describe('lluvia fuerte', () => {
    it.each([
      [7.5, null],
      [7.6, NivelAlertaClima.Precaucion],
      [24.9, NivelAlertaClima.Precaucion],
      [25, NivelAlertaClima.Peligro],
      [60, NivelAlertaClima.Peligro],
    ])('%d mm/h -> %s', (mm, nivel) => {
      const lluvia = soloTipo(
        clasificarPronostico([hora({ precipitacionMmH: mm })]),
        TipoAlertaClima.Lluvia,
      );
      if (nivel === null) {
        expect(lluvia).toEqual([]);
      } else {
        expect(lluvia).toEqual([
          { tipo: TipoAlertaClima.Lluvia, nivel, enHoras: 0, valor: mm },
        ]);
      }
    });

    it.each([65, 67, 82])(
      'el codigo %i (lluvia intensa) alerta aunque la medicion sea baja',
      (codigoWmo) => {
        const lluvia = soloTipo(
          clasificarPronostico([hora({ codigoWmo, precipitacionMmH: 1 })]),
          TipoAlertaClima.Lluvia,
        );
        expect(lluvia).toEqual([
          {
            tipo: TipoAlertaClima.Lluvia,
            nivel: NivelAlertaClima.Precaucion,
            enHoras: 0,
            valor: 1,
          },
        ]);
      },
    );

    it.each([61, 63, 80, 81])(
      'el codigo %i (lluvia leve o moderada) no alerta',
      (codigoWmo) => {
        expect(
          clasificarPronostico([hora({ codigoWmo, precipitacionMmH: 2 })]),
        ).toEqual([]);
      },
    );
  });

  describe('tormenta electrica', () => {
    it.each([95, 96, 99])('el codigo %i es peligro', (codigoWmo) => {
      expect(clasificarPronostico([hora({ codigoWmo })])).toEqual([
        {
          tipo: TipoAlertaClima.Tormenta,
          nivel: NivelAlertaClima.Peligro,
          enHoras: 0,
          valor: null,
        },
      ]);
    });
  });

  describe('calor extremo', () => {
    it.each([
      [34.9, null],
      [35, NivelAlertaClima.Precaucion],
      [39.9, NivelAlertaClima.Precaucion],
      [40, NivelAlertaClima.Peligro],
      [46.2, NivelAlertaClima.Peligro],
    ])('%d °C de sensacion termica -> %s', (grados, nivel) => {
      const calor = soloTipo(
        clasificarPronostico([hora({ sensacionC: grados })]),
        TipoAlertaClima.Calor,
      );
      if (nivel === null) {
        expect(calor).toEqual([]);
      } else {
        expect(calor).toEqual([
          { tipo: TipoAlertaClima.Calor, nivel, enHoras: 0, valor: grados },
        ]);
      }
    });
  });

  describe('varias horas', () => {
    it('de cada tipo avisa solo el peor momento', () => {
      const alertas = clasificarPronostico([
        hora({ precipitacionMmH: 8 }),
        hora({ precipitacionMmH: 30 }),
        hora({ precipitacionMmH: 9 }),
      ]);
      expect(alertas).toEqual([
        {
          tipo: TipoAlertaClima.Lluvia,
          nivel: NivelAlertaClima.Peligro,
          enHoras: 1,
          valor: 30,
        },
      ]);
    });

    it('a igual gravedad prefiere la medicion mas alta', () => {
      const [lluvia] = clasificarPronostico([
        hora({ precipitacionMmH: 9 }),
        hora({ precipitacionMmH: 14 }),
        hora({ precipitacionMmH: 10 }),
      ]);
      expect(lluvia.enHoras).toBe(1);
      expect(lluvia.valor).toBe(14);
    });

    it('a igual gravedad y valor prefiere el momento mas cercano', () => {
      const [calor] = clasificarPronostico([
        hora(),
        hora({ sensacionC: 37 }),
        hora({ sensacionC: 37 }),
      ]);
      expect(calor.tipo).toBe(TipoAlertaClima.Calor);
      expect(calor.enHoras).toBe(1);
    });

    it('la tormenta de varias horas se cuenta desde la primera', () => {
      const [tormenta] = clasificarPronostico([
        hora(),
        hora({ codigoWmo: 95 }),
        hora({ codigoWmo: 96 }),
      ]);
      expect(tormenta.tipo).toBe(TipoAlertaClima.Tormenta);
      expect(tormenta.enHoras).toBe(1);
    });

    it('combina tipos: primero lo mas grave y, a igual gravedad, lo mas cercano', () => {
      const alertas = clasificarPronostico([
        hora({ sensacionC: 36 }), // calor: precaucion, ahora
        hora({ precipitacionMmH: 10 }), // lluvia: precaucion, en 1 h
        hora({ codigoWmo: 95 }), // tormenta: peligro, en 2 h
      ]);
      expect(alertas.map((a) => [a.tipo, a.nivel, a.enHoras])).toEqual([
        [TipoAlertaClima.Tormenta, NivelAlertaClima.Peligro, 2],
        [TipoAlertaClima.Calor, NivelAlertaClima.Precaucion, 0],
        [TipoAlertaClima.Lluvia, NivelAlertaClima.Precaucion, 1],
      ]);
    });
  });

  describe('datos incompletos', () => {
    it('ignora los campos que el proveedor no informo', () => {
      expect(
        clasificarPronostico([
          { precipitacionMmH: null, sensacionC: null, codigoWmo: null },
        ]),
      ).toEqual([]);
    });

    it('un campo que falta no tapa a los demas', () => {
      const alertas = clasificarPronostico([
        { precipitacionMmH: null, sensacionC: 41, codigoWmo: null },
      ]);
      expect(alertas.map((a) => a.tipo)).toEqual([TipoAlertaClima.Calor]);
    });
  });

  it('redondea el valor a un decimal', () => {
    const [lluvia] = clasificarPronostico([hora({ precipitacionMmH: 12.345 })]);
    expect(lluvia.valor).toBe(12.3);
  });
});
