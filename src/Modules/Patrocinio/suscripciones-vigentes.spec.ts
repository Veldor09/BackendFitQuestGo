import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuscripcionesVigentesSql } from './suscripciones-vigentes';

describe('SuscripcionesVigentesSql — vigencia sobre la tabla de ADM-09A', () => {
  let dataSource: { query: jest.Mock };
  let puerto: SuscripcionesVigentesSql;
  let aviso: jest.SpyInstance;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    puerto = new SuscripcionesVigentesSql(dataSource as unknown as DataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sin usuarios no consulta nada', async () => {
    expect(await puerto.conVigencia([])).toEqual(new Set());
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('devuelve los usuarios con suscripcion Activa y vigente ahora', async () => {
    dataSource.query.mockResolvedValue([{ usuario_id: 1 }, { usuario_id: 3 }]);
    const ahora = new Date('2026-10-20T12:00:00Z');

    expect(await puerto.conVigencia([1, 2, 3], ahora)).toEqual(new Set([1, 3]));

    const [sql, parametros] = dataSource.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain("estado = 'Activa'");
    expect(sql).toContain('inicia_en <= $2');
    expect(sql).toContain('vence_en > $2');
    expect(parametros).toEqual([[1, 2, 3], ahora]);
  });

  it('si la tabla aun no existe (42P01) responde que nadie tiene plan', async () => {
    // Review Focus 1: 09A todavia no esta mergeada y el servidor debe seguir vivo.
    dataSource.query.mockRejectedValue(
      Object.assign(new Error('no existe la relacion'), {
        driverError: { code: '42P01' },
      }),
    );

    expect(await puerto.conVigencia([1])).toEqual(new Set());
    expect(await puerto.vencenEntre(new Date(), new Date())).toEqual([]);
    // Se avisa una sola vez, no en cada lectura del mapa.
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('cualquier otro error de la base se propaga', async () => {
    dataSource.query.mockRejectedValue(new Error('caida'));

    await expect(puerto.conVigencia([1])).rejects.toThrow('caida');
    expect(aviso).not.toHaveBeenCalled();
  });

  it('vencenEntre devuelve id, usuario y fecha de las Activa o Vencida que vencen en (desde, hasta]', async () => {
    const venceEn = new Date('2026-10-23T18:00:00Z');
    dataSource.query.mockResolvedValue([
      { suscripcion_id: 9, usuario_id: 4, vence_en: venceEn },
    ]);
    const desde = new Date('2026-10-20T00:00:00Z');
    const hasta = new Date('2026-10-24T00:00:00Z');

    expect(await puerto.vencenEntre(desde, hasta)).toEqual([
      { suscripcionId: 9, usuarioId: 4, venceEn },
    ]);

    const [sql, parametros] = dataSource.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain("estado IN ('Activa', 'Vencida')");
    expect(sql).toContain('vence_en > $1');
    expect(sql).toContain('vence_en <= $2');
    expect(parametros).toEqual([desde, hasta]);
  });
});
