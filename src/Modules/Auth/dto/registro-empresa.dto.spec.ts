import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegistroEmpresaDto } from './registro-empresa.dto';

function dtoValido(
  overrides: Partial<RegistroEmpresaDto> = {},
): RegistroEmpresaDto {
  return plainToInstance(RegistroEmpresaDto, {
    nombreComercial: 'Cafe El Roble 2',
    email: 'contacto@elroble.co',
    contrasena: 'contrasena123',
    aceptaTerminos: true,
    ...overrides,
  });
}

async function camposConError(dto: RegistroEmpresaDto): Promise<string[]> {
  return (await validate(dto)).map((e) => e.property);
}

describe('RegistroEmpresaDto', () => {
  it('es valido sin telefono', async () => {
    expect(await validate(dtoValido())).toHaveLength(0);
  });

  it('admite nombre comercial con numeros y signos, a diferencia del nombre de persona', async () => {
    const dto = dtoValido({ nombreComercial: "Bici & Cafe 'La 7' S.A." });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['8888-8888', '+506 8888 8888', '88888888'])(
    'acepta el telefono %s',
    async (telefono) => {
      expect(await validate(dtoValido({ telefono }))).toHaveLength(0);
    },
  );

  it.each(['123', 'abcdefgh', '8888-8888-8888-8888-8888'])(
    'rechaza el telefono %s',
    async (telefono) => {
      expect(await camposConError(dtoValido({ telefono }))).toContain(
        'telefono',
      );
    },
  );

  it.each(['', '   ', 'A'])(
    'rechaza el nombre comercial "%s"',
    async (nombreComercial) => {
      expect(await camposConError(dtoValido({ nombreComercial }))).toContain(
        'nombreComercial',
      );
    },
  );

  it('rechaza un nombre comercial de mas de 100 caracteres', async () => {
    const dto = dtoValido({ nombreComercial: 'a'.repeat(101) });
    expect(await camposConError(dto)).toContain('nombreComercial');
  });

  it('rechaza contrasena corta y correo invalido', async () => {
    const campos = await camposConError(
      dtoValido({ contrasena: 'corta', email: 'no-es-correo' }),
    );
    expect(campos).toEqual(expect.arrayContaining(['contrasena', 'email']));
  });

  it('exige aceptar los terminos', async () => {
    expect(
      await camposConError(dtoValido({ aceptaTerminos: false })),
    ).toContain('aceptaTerminos');
  });
});
