import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EstadoAlerta, GravedadAlerta } from '../estado-alerta.enum';
import { TipoAlerta } from '../tipo-alerta.enum';
import { CambiarEstadoAlertaDto, CrearAlertaDto } from './AlertaDTO';

const base = {
  tipo: TipoAlerta.Bache,
  gravedad: GravedadAlerta.Media,
  lat: 9.93,
  lng: -84.09,
};

const dto = (extra: Record<string, unknown> = {}) =>
  plainToInstance(CrearAlertaDto, { ...base, ...extra });

const camposConError = async (d: CrearAlertaDto) =>
  (await validate(d)).map((e) => e.property);

describe('CrearAlertaDto — tipo de alerta de lista cerrada', () => {
  it.each(Object.values(TipoAlerta).filter((t) => t !== TipoAlerta.Otro))(
    'acepta el tipo %s sin texto adicional',
    async (tipo) => {
      expect(await camposConError(dto({ tipo }))).toEqual([]);
    },
  );

  it.each(['Bache', 'arbol caido', 'perro bravo', 'Arbol caido', ''])(
    'rechaza texto libre como tipo ("%s")',
    async (tipo) => {
      expect(await camposConError(dto({ tipo }))).toContain('tipo');
    },
  );

  it('rechaza si falta el tipo', async () => {
    const d = dto();
    delete (d as Partial<CrearAlertaDto>).tipo;
    expect(await camposConError(d)).toContain('tipo');
  });

  describe('"otro"', () => {
    it('exige escribir cual es', async () => {
      expect(await camposConError(dto({ tipo: TipoAlerta.Otro }))).toContain(
        'tipoOtro',
      );
    });

    it('no acepta solo espacios', async () => {
      const d = dto({ tipo: TipoAlerta.Otro, tipoOtro: '    ' });
      expect(await camposConError(d)).toContain('tipoOtro');
    });

    it('acepta un texto', async () => {
      const d = dto({ tipo: TipoAlerta.Otro, tipoOtro: 'Poste inclinado' });
      expect(await camposConError(d)).toEqual([]);
    });

    it('rechaza mas de 50 caracteres', async () => {
      const d = dto({ tipo: TipoAlerta.Otro, tipoOtro: 'x'.repeat(51) });
      expect(await camposConError(d)).toContain('tipoOtro');
    });

    it('recorta los espacios de los extremos', () => {
      const d = dto({ tipo: TipoAlerta.Otro, tipoOtro: '  Poste inclinado  ' });
      expect(d.tipoOtro).toBe('Poste inclinado');
    });
  });

  it('con un tipo del catalogo no valida el texto "otro"', async () => {
    const d = dto({ tipo: TipoAlerta.Bache, tipoOtro: 'x'.repeat(200) });
    expect(await camposConError(d)).toEqual([]);
  });
});

describe('CambiarEstadoAlertaDto — el admin solo reabre o resuelve', () => {
  const erroresDe = async (estado: unknown) =>
    (await validate(plainToInstance(CambiarEstadoAlertaDto, { estado }))).map(
      (e) => e.property,
    );

  it.each([EstadoAlerta.Activa, EstadoAlerta.Resuelta])(
    'acepta %s',
    async (estado) => {
      expect(await erroresDe(estado)).toEqual([]);
    },
  );

  it('rechaza Expirada: ese estado solo lo pone el paso del tiempo', async () => {
    expect(await erroresDe(EstadoAlerta.Expirada)).toContain('estado');
  });

  it.each(['activa', 'Cerrada', '', null])('rechaza %p', async (estado) => {
    expect(await erroresDe(estado)).toContain('estado');
  });

  it('rechaza si falta el estado', async () => {
    const errores = await validate(plainToInstance(CambiarEstadoAlertaDto, {}));
    expect(errores.map((e) => e.property)).toContain('estado');
  });
});
