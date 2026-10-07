import { RoleId } from '../Usuarios/roles.enum';
import { creadorEsEmpresa, esEmpresa, puedeVerContenidoDe } from './es-empresa';

const deEmpresa = { idrol: RoleId.Empresa };
const deDeportista = { idrol: RoleId.UserNormal };
const deAdmin = { idrol: RoleId.Admin };

describe('esEmpresa', () => {
  it('solo es verdadero para el rol Empresa', () => {
    expect(esEmpresa({ rol: RoleId.Empresa })).toBe(true);
    expect(esEmpresa({ rol: RoleId.UserNormal })).toBe(false);
    expect(esEmpresa({ rol: RoleId.Admin })).toBe(false);
  });
});

describe('creadorEsEmpresa', () => {
  it('mira el rol de quien creo el contenido', () => {
    expect(creadorEsEmpresa(deEmpresa)).toBe(true);
    expect(creadorEsEmpresa(deDeportista)).toBe(false);
  });

  it('sin dato del creador no se asume que sea empresa', () => {
    expect(creadorEsEmpresa(undefined)).toBe(false);
    expect(creadorEsEmpresa(null)).toBe(false);
    expect(creadorEsEmpresa({})).toBe(false);
  });
});

describe('puedeVerContenidoDe (empresas no ven lo de los deportistas)', () => {
  const empresa = { rol: RoleId.Empresa };

  it('una empresa ve lo que crearon empresas (la suya y las de otras)', () => {
    expect(puedeVerContenidoDe(empresa, deEmpresa)).toBe(true);
  });

  it('una empresa NO ve lo que crearon deportistas', () => {
    expect(puedeVerContenidoDe(empresa, deDeportista)).toBe(false);
  });

  it('una empresa NO ve lo de un admin ni lo de un creador desconocido', () => {
    expect(puedeVerContenidoDe(empresa, deAdmin)).toBe(false);
    expect(puedeVerContenidoDe(empresa, undefined)).toBe(false);
  });

  it('un deportista sigue viendo todo: lo de deportistas y lo de empresas', () => {
    const deportista = { rol: RoleId.UserNormal };
    expect(puedeVerContenidoDe(deportista, deDeportista)).toBe(true);
    expect(puedeVerContenidoDe(deportista, deEmpresa)).toBe(true);
  });

  it('un admin ve todo (lo necesita para moderar)', () => {
    const admin = { rol: RoleId.Admin };
    expect(puedeVerContenidoDe(admin, deDeportista)).toBe(true);
    expect(puedeVerContenidoDe(admin, deEmpresa)).toBe(true);
  });
});
