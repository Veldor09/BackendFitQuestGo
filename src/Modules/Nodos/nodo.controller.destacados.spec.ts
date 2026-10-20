import 'reflect-metadata';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { DestacadosService } from '../Patrocinio/destacados.service';
import { RoleId } from '../Usuarios/roles.enum';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

describe('NodoController — destacados', () => {
  const actual: UsuarioAutenticado = {
    id: 7,
    email: 'ana@example.com',
    rol: RoleId.UserNormal,
  };
  const a = { id: 1, nombre: 'A' };
  const b = { id: 2, nombre: 'B' };
  let nodoService: Record<string, jest.Mock>;
  let destacados: Record<string, jest.Mock>;
  let controlador: NodoController;

  beforeEach(() => {
    nodoService = {
      findAprobados: jest.fn(),
      findMisNodos: jest.fn(),
      confirmar: jest.fn(),
      marcarObsoleto: jest.fn(),
    };
    destacados = {
      nodosConDestacado: jest.fn(),
      nodoConDestacado: jest.fn(),
      destacarNodo: jest.fn(),
    };
    controlador = new NodoController(
      nodoService as unknown as NodoService,
      destacados as unknown as DestacadosService,
    );
  });

  it('GET /nodos devuelve lo que compone DestacadosService', async () => {
    nodoService.findAprobados.mockResolvedValue([a, b]);
    destacados.nodosConDestacado.mockResolvedValue([
      { ...b, destacado: true },
      { ...a, destacado: false },
    ]);

    await expect(controlador.findAprobados(actual)).resolves.toEqual([
      { ...b, destacado: true },
      { ...a, destacado: false },
    ]);
    expect(destacados.nodosConDestacado).toHaveBeenCalledWith([a, b]);
  });

  it('GET /nodos/mios tambien lleva destacado', async () => {
    nodoService.findMisNodos.mockResolvedValue([a]);
    destacados.nodosConDestacado.mockResolvedValue([{ ...a, destacado: true }]);

    await expect(controlador.findMisNodos(actual)).resolves.toEqual([
      { ...a, destacado: true },
    ]);
    expect(nodoService.findMisNodos).toHaveBeenCalledWith(7);
    expect(destacados.nodosConDestacado).toHaveBeenCalledWith([a]);
  });

  it('votar un punto lo devuelve con `destacado`, para que la ficha no pierda el dorado', async () => {
    // Review Focus 3
    const votado = { id: 5, nombre: 'Soda', miVoto: 'confirmar' };
    const dto = { lat: 9.9, lng: -84 };
    nodoService.confirmar.mockResolvedValue(votado);
    nodoService.marcarObsoleto.mockResolvedValue(votado);
    destacados.nodoConDestacado.mockResolvedValue({ ...votado, destacado: true });

    await expect(controlador.confirmar(5, dto, actual)).resolves.toMatchObject({
      id: 5,
      destacado: true,
    });
    await expect(
      controlador.marcarObsoleto(5, dto, actual),
    ).resolves.toMatchObject({ id: 5, destacado: true });
    expect(destacados.nodoConDestacado).toHaveBeenCalledTimes(2);
    expect(destacados.nodoConDestacado).toHaveBeenCalledWith(votado);
  });

  it('PATCH /nodos/:id/destacar pasa id, actor y bandera al servicio', async () => {
    destacados.destacarNodo.mockResolvedValue({
      id: 5,
      destacarActivado: true,
      destacado: true,
    });

    await expect(
      controlador.destacar(5, { destacar: true }, actual),
    ).resolves.toEqual({ id: 5, destacarActivado: true, destacado: true });
    expect(destacados.destacarNodo).toHaveBeenCalledWith(5, actual, true);
  });

  it('exige iniciar sesion', () => {
    const guardias = Reflect.getMetadata('__guards__', NodoController) as
      | unknown[]
      | undefined;
    expect(guardias).toContain(GuardiaJwt);
  });
});
