// `@Type()` de class-transformer necesita el polyfill; Nest lo carga solo, un
// spec suelto no.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActividadRuta } from '../actividad-ruta.enum';
import { CrearRutaDto } from './RutaDTO';

const base = {
  nombre: 'Vuelta al lago',
  actividades: [ActividadRuta.Running],
  distanciaKm: 5,
  puntos: [
    { lat: 9.93, lng: -84.09 },
    { lat: 9.94, lng: -84.1 },
  ],
};

const dto = (extra: Record<string, unknown> = {}) =>
  plainToInstance(CrearRutaDto, { ...base, ...extra });

const camposConError = async (d: CrearRutaDto) =>
  (await validate(d)).map((e) => e.property);

describe('CrearRutaDto — actividades de lista cerrada', () => {
  it('acepta una actividad', async () => {
    expect(await camposConError(dto())).toEqual([]);
  });

  it('acepta varias actividades a la vez', async () => {
    const d = dto({
      actividades: [
        ActividadRuta.Caminata,
        ActividadRuta.Hiking,
        ActividadRuta.Running,
      ],
    });
    expect(await camposConError(d)).toEqual([]);
  });

  it.each(Object.values(ActividadRuta))('acepta %s', async (actividad) => {
    expect(await camposConError(dto({ actividades: [actividad] }))).toEqual([]);
  });

  it('rechaza una lista vacia', async () => {
    expect(await camposConError(dto({ actividades: [] }))).toContain(
      'actividades',
    );
  });

  it('rechaza si falta', async () => {
    const d = dto();
    delete (d as Partial<CrearRutaDto>).actividades;
    expect(await camposConError(d)).toContain('actividades');
  });

  it('rechaza texto libre o con errores de tipeo', async () => {
    expect(await camposConError(dto({ actividades: ['Runing'] }))).toContain(
      'actividades',
    );
    expect(await camposConError(dto({ actividades: ['Running'] }))).toContain(
      'actividades',
    );
  });

  it('rechaza actividades repetidas', async () => {
    const d = dto({
      actividades: [ActividadRuta.Running, ActividadRuta.Running],
    });
    expect(await camposConError(d)).toContain('actividades');
  });

  it('rechaza un valor que no es una lista', async () => {
    expect(await camposConError(dto({ actividades: 'running' }))).toContain(
      'actividades',
    );
  });
});
