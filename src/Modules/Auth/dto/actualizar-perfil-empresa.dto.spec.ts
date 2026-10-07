import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarPerfilEmpresaDto } from './actualizar-perfil-empresa.dto';

const campos = async (cuerpo: Record<string, unknown>): Promise<string[]> =>
  (await validate(plainToInstance(ActualizarPerfilEmpresaDto, cuerpo))).map(
    (e) => e.property,
  );

describe('ActualizarPerfilEmpresaDto', () => {
  it('un cuerpo vacio es valido (no cambia nada)', async () => {
    expect(await campos({})).toEqual([]);
  });

  it('acepta un nombre comercial con numeros y signos', async () => {
    expect(
      await campos({ nombreComercial: "Bici & Cafe 'La 7' S.A." }),
    ).toEqual([]);
  });

  it.each(['', '   ', 'A'])('rechaza el nombre comercial "%s"', async (n) => {
    expect(await campos({ nombreComercial: n })).toContain('nombreComercial');
  });

  it('rechaza un nombre comercial de mas de 100 caracteres', async () => {
    expect(await campos({ nombreComercial: 'a'.repeat(101) })).toContain(
      'nombreComercial',
    );
  });

  it.each(['8888-8888', '+506 8888 8888'])(
    'acepta el telefono %s',
    async (t) => {
      expect(await campos({ telefono: t })).toEqual([]);
    },
  );

  it('un telefono vacio es valido: sirve para borrarlo', async () => {
    expect(await campos({ telefono: '' })).toEqual([]);
  });

  it.each(['123', 'abcdefgh'])('rechaza el telefono %s', async (t) => {
    expect(await campos({ telefono: t })).toContain('telefono');
  });
});
