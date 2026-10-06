import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoriaNodo } from '../categoria-nodo.enum';
import { EstadoNodo } from '../estado-nodo.enum';
import {
  ActualizarNodoDto,
  CambiarEstadoNodoDto,
  CrearNodoDto,
  VotarNodoDto,
} from './NodoDTO';

const base = {
  nombre: 'Fuente del parque',
  categoria: CategoriaNodo.Agua,
  lat: 9.93,
  lng: -84.09,
};

const dto = (extra: Record<string, unknown> = {}) =>
  plainToInstance(CrearNodoDto, { ...base, ...extra });

const camposConError = async (d: object) =>
  (await validate(d)).map((e) => e.property);

describe('CrearNodoDto — categoria de lista cerrada', () => {
  it.each(Object.values(CategoriaNodo).filter((c) => c !== CategoriaNodo.Otro))(
    'acepta la categoria %s',
    async (categoria) => {
      expect(await camposConError(dto({ categoria }))).toEqual([]);
    },
  );

  it.each(['Agua', 'agua potable', 'Mirador', ''])(
    'rechaza texto libre como categoria ("%s")',
    async (categoria) => {
      expect(await camposConError(dto({ categoria }))).toContain('categoria');
    },
  );

  describe('"otro"', () => {
    it('exige escribir cual es', async () => {
      const d = dto({ categoria: CategoriaNodo.Otro });
      expect(await camposConError(d)).toContain('categoriaOtro');
    });

    it('no acepta solo espacios', async () => {
      const d = dto({ categoria: CategoriaNodo.Otro, categoriaOtro: '   ' });
      expect(await camposConError(d)).toContain('categoriaOtro');
    });

    it('acepta un texto y lo recorta', async () => {
      const d = dto({
        categoria: CategoriaNodo.Otro,
        categoriaOtro: '  Zona de picnic ',
      });
      expect(await camposConError(d)).toEqual([]);
      expect(d.categoriaOtro).toBe('Zona de picnic');
    });

    it('rechaza mas de 50 caracteres', async () => {
      const d = dto({
        categoria: CategoriaNodo.Otro,
        categoriaOtro: 'x'.repeat(51),
      });
      expect(await camposConError(d)).toContain('categoriaOtro');
    });
  });

  it('con una categoria del catalogo no valida el texto "otro"', async () => {
    const d = dto({ categoriaOtro: 'x'.repeat(200) });
    expect(await camposConError(d)).toEqual([]);
  });
});

describe('ActualizarNodoDto', () => {
  const parcial = (datos: Record<string, unknown>) =>
    plainToInstance(ActualizarNodoDto, datos);

  it('permite cambiar solo el nombre', async () => {
    expect(await camposConError(parcial({ nombre: 'Otro nombre' }))).toEqual(
      [],
    );
  });

  it('rechaza una categoria fuera del catalogo', async () => {
    expect(await camposConError(parcial({ categoria: 'Agua' }))).toContain(
      'categoria',
    );
  });
});

describe('VotarNodoDto — posicion de quien vota', () => {
  const voto = (datos: Record<string, unknown>) =>
    plainToInstance(VotarNodoDto, datos);

  it('acepta una posicion valida', async () => {
    expect(await camposConError(voto({ lat: 9.93, lng: -84.09 }))).toEqual([]);
  });

  it.each([
    [{ lat: 91, lng: -84.09 }, 'lat'],
    [{ lat: 9.93, lng: 181 }, 'lng'],
    [{ lat: 'x', lng: -84.09 }, 'lat'],
    [{ lng: -84.09 }, 'lat'],
    [{ lat: 9.93 }, 'lng'],
  ])('rechaza %j (campo %s)', async (datos, campo) => {
    expect(await camposConError(voto(datos))).toContain(campo);
  });
});

describe('CambiarEstadoNodoDto — el admin elige el estado', () => {
  const estadoDe = (estado: unknown) =>
    plainToInstance(CambiarEstadoNodoDto, { estado });

  it.each(Object.values(EstadoNodo))('acepta %s', async (estado) => {
    expect(await camposConError(estadoDe(estado))).toEqual([]);
  });

  it.each(['aprobado', 'Cerrado', ''])('rechaza "%s"', async (estado) => {
    expect(await camposConError(estadoDe(estado))).toContain('estado');
  });
});
