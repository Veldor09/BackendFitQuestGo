import {
  IDIOMAS_PUSH,
  idiomaPushValido,
  textoPush,
  TipoPush,
} from './push-plantillas';

describe('push-plantillas', () => {
  it('cada tipo tiene texto en los tres idiomas, con titulo y cuerpo', () => {
    for (const tipo of Object.values(TipoPush)) {
      for (const idioma of IDIOMAS_PUSH) {
        const { titulo, cuerpo } = textoPush(
          {
            tipo,
            params: {
              nombre: 'Cerro Chirripó',
              venceEn: '2026-10-23T18:00:00Z',
            },
          },
          idioma,
        );
        expect(titulo.length).toBeGreaterThan(5);
        expect(cuerpo.length).toBeGreaterThan(5);
      }
    }
  });

  it('el mismo aviso cambia de texto segun el idioma del telefono', () => {
    const solicitud = {
      tipo: TipoPush.RutaAprobada,
      params: { nombre: 'Sendero Norte' },
    };
    const es = textoPush(solicitud, 'es');
    const en = textoPush(solicitud, 'en');
    const pt = textoPush(solicitud, 'pt');

    expect(es.titulo).toBe('¡Tu ruta fue aprobada!');
    expect(en.titulo).toBe('Your route was approved!');
    expect(pt.titulo).toBe('Sua rota foi aprovada!');
    expect(en.cuerpo).toContain('"Sendero Norte"');
  });

  it('un idioma desconocido o vacio cae en español; pt-BR cuenta como pt', () => {
    expect(idiomaPushValido('fr')).toBe('es');
    expect(idiomaPushValido(null)).toBe('es');
    expect(idiomaPushValido(undefined)).toBe('es');
    expect(idiomaPushValido('pt-BR')).toBe('pt');
    expect(idiomaPushValido('EN')).toBe('en');
  });

  it('"vence pronto" pone la fecha en hora de Costa Rica y en el idioma del telefono', () => {
    const solicitud = {
      tipo: TipoPush.PlanPorVencer,
      params: { venceEn: '2026-10-23T18:00:00Z' },
    };
    expect(textoPush(solicitud, 'es').cuerpo).toContain(
      '23 de octubre de 2026',
    );
    expect(textoPush(solicitud, 'en').cuerpo).toContain('October 23, 2026');
    expect(textoPush(solicitud, 'pt').cuerpo).toContain(
      '23 de outubro de 2026',
    );
  });

  it('una fecha invalida no rompe el aviso', () => {
    const { cuerpo } = textoPush(
      { tipo: TipoPush.PlanPorVencer, params: { venceEn: 'no-es-fecha' } },
      'es',
    );
    expect(cuerpo).toContain('Vence el');
  });
});
