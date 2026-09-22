import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegistroDto } from './registro.dto';

function dtoValido(overrides: Partial<RegistroDto> = {}): RegistroDto {
  return plainToInstance(RegistroDto, {
    nombre: 'Ana',
    email: 'ana@correo.com',
    contrasena: 'contrasena123',
    aceptaTerminos: true,
    ...overrides,
  });
}

describe('RegistroDto', () => {
  it('es valido cuando aceptaTerminos es true', async () => {
    const errores = await validate(dtoValido());
    expect(errores).toHaveLength(0);
  });

  it('rechaza aceptaTerminos en false', async () => {
    const errores = await validate(dtoValido({ aceptaTerminos: false }));
    const campo = errores.find((e) => e.property === 'aceptaTerminos');
    expect(campo).toBeDefined();
  });

  it('rechaza cuando falta aceptaTerminos', async () => {
    const dto = dtoValido();
    delete (dto as Partial<RegistroDto>).aceptaTerminos;
    const errores = await validate(dto);
    const campo = errores.find((e) => e.property === 'aceptaTerminos');
    expect(campo).toBeDefined();
  });
});
