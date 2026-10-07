import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoriaEvento } from '../categoria-evento.enum';
import {
  ActualizarEventoDto,
  CrearEventoDto,
  MAX_PUNTOS_TRAZO,
  MAX_TRAZOS_EVENTO,
} from './EventoDTO';

const area = {
  nombre: 'Salida',
  puntos: [
    { lat: 10, lng: -84 },
    { lat: 10.001, lng: -84 },
    { lat: 10.001, lng: -84.001 },
  ],
};
const recorrido = {
  nombre: '5k',
  puntos: [
    { lat: 10, lng: -84 },
    { lat: 10.002, lng: -84.002 },
  ],
};

const base = {
  nombre: 'Caminata',
  categoria: CategoriaEvento.Caminata,
  fechaInicio: '2030-05-01T12:00:00.000Z',
  fechaFin: '2030-05-01T15:00:00.000Z',
  areas: [area],
  recorridos: [recorrido],
};

const crear = (extra: Record<string, unknown> = {}) =>
  plainToInstance(CrearEventoDto, { ...base, ...extra });

/** Rutas completas de propiedad con error, p. ej. "areas.0.puntos". */
async function rutasConError(d: object): Promise<string[]> {
  const rutas: string[] = [];
  const recorrer = (
    errores: Awaited<ReturnType<typeof validate>>,
    prefijo: string,
  ) => {
    for (const e of errores) {
      const ruta = prefijo ? `${prefijo}.${e.property}` : e.property;
      if (e.constraints) rutas.push(ruta);
      if (e.children?.length) recorrer(e.children, ruta);
    }
  };
  recorrer(await validate(d), '');
  return rutas;
}

describe('CrearEventoDto', () => {
  it('es valido con area y recorrido', async () => {
    expect(await rutasConError(crear())).toEqual([]);
  });

  it('convierte las fechas en texto ISO a Date', () => {
    const d = crear();
    expect(d.fechaInicio).toBeInstanceOf(Date);
    expect(d.fechaFin).toBeInstanceOf(Date);
  });

  it.each(Object.values(CategoriaEvento))(
    'acepta la categoria %s',
    async (categoria) => {
      expect(await rutasConError(crear({ categoria }))).toEqual([]);
    },
  );

  it('rechaza una categoria que no esta en la lista', async () => {
    expect(await rutasConError(crear({ categoria: 'fiesta' }))).toContain(
      'categoria',
    );
  });

  it.each(['', '   '])('rechaza el nombre "%s"', async (nombre) => {
    expect(await rutasConError(crear({ nombre }))).toContain('nombre');
  });

  it('rechaza una fecha que no es fecha', async () => {
    expect(await rutasConError(crear({ fechaInicio: 'manana' }))).toContain(
      'fechaInicio',
    );
  });

  it('rechaza una descripcion de mas de 500 caracteres', async () => {
    expect(
      await rutasConError(crear({ descripcion: 'a'.repeat(501) })),
    ).toContain('descripcion');
  });

  describe('areas', () => {
    it('necesitan al menos 3 puntos', async () => {
      const dosPuntos = { nombre: 'Corta', puntos: area.puntos.slice(0, 2) };
      expect(await rutasConError(crear({ areas: [dosPuntos] }))).toContain(
        'areas.0.puntos',
      );
    });

    it('necesitan nombre', async () => {
      expect(
        await rutasConError(crear({ areas: [{ ...area, nombre: '' }] })),
      ).toContain('areas.0.nombre');
    });

    it('rechazan coordenadas fuera de rango', async () => {
      const mala = {
        nombre: 'Mala',
        puntos: [...area.puntos.slice(0, 2), { lat: 95, lng: -84 }],
      };
      expect(await rutasConError(crear({ areas: [mala] }))).toContain(
        'areas.0.puntos.2.lat',
      );
    });
  });

  describe('recorridos', () => {
    it('necesitan al menos 2 puntos', async () => {
      const unPunto = { nombre: 'Corto', puntos: [recorrido.puntos[0]] };
      expect(await rutasConError(crear({ recorridos: [unPunto] }))).toContain(
        'recorridos.0.puntos',
      );
    });

    it('no admiten mas de MAX_PUNTOS_TRAZO puntos', async () => {
      const enorme = {
        nombre: 'Enorme',
        puntos: Array.from({ length: MAX_PUNTOS_TRAZO + 1 }, (_, i) => ({
          lat: 10 + i * 1e-6,
          lng: -84,
        })),
      };
      expect(await rutasConError(crear({ recorridos: [enorme] }))).toContain(
        'recorridos.0.puntos',
      );
    });
  });

  it('no admite mas de MAX_TRAZOS_EVENTO areas', async () => {
    const muchas = Array.from({ length: MAX_TRAZOS_EVENTO + 1 }, () => area);
    expect(await rutasConError(crear({ areas: muchas }))).toContain('areas');
  });
});

describe('ActualizarEventoDto', () => {
  it('acepta un cuerpo parcial', async () => {
    const d = plainToInstance(ActualizarEventoDto, { nombre: 'Nuevo' });
    expect(await rutasConError(d)).toEqual([]);
  });

  it('sigue validando los trazos que si se envian', async () => {
    const d = plainToInstance(ActualizarEventoDto, {
      areas: [{ nombre: 'Corta', puntos: area.puntos.slice(0, 1) }],
    });
    expect(await rutasConError(d)).toContain('areas.0.puntos');
  });
});
