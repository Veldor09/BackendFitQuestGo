import 'reflect-metadata';
import { CLAVE_ROLES } from '../Auth/decorators/roles.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { DestacadosService } from '../Patrocinio/destacados.service';
import { RoleId } from '../Usuarios/roles.enum';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';

describe('EventoController — destacados', () => {
  const actual: UsuarioAutenticado = {
    id: 8,
    email: 'bici@example.com',
    rol: RoleId.Empresa,
  };
  const e1 = { id: 1, nombre: 'Carrera' };
  const e2 = { id: 2, nombre: 'Caminata' };
  let eventoService: Record<string, jest.Mock>;
  let destacados: Record<string, jest.Mock>;
  let controlador: EventoController;

  beforeEach(() => {
    eventoService = { findVigentes: jest.fn(), findMios: jest.fn() };
    destacados = {
      eventosConDestacado: jest.fn(),
      destacarEvento: jest.fn(),
    };
    controlador = new EventoController(
      eventoService as unknown as EventoService,
      destacados as unknown as DestacadosService,
    );
  });

  it('GET /eventos devuelve lo que compone DestacadosService', async () => {
    eventoService.findVigentes.mockResolvedValue([e1, e2]);
    destacados.eventosConDestacado.mockResolvedValue([
      { ...e2, destacado: true },
      { ...e1, destacado: false },
    ]);

    await expect(controlador.findVigentes()).resolves.toEqual([
      { ...e2, destacado: true },
      { ...e1, destacado: false },
    ]);
    expect(destacados.eventosConDestacado).toHaveBeenCalledWith([e1, e2]);
  });

  it('GET /eventos/mios tambien lleva destacado', async () => {
    eventoService.findMios.mockResolvedValue([e1]);
    destacados.eventosConDestacado.mockResolvedValue([
      { ...e1, destacado: true },
    ]);

    await expect(controlador.findMios(actual)).resolves.toEqual([
      { ...e1, destacado: true },
    ]);
    expect(eventoService.findMios).toHaveBeenCalledWith(8);
  });

  it('PATCH /eventos/:id/destacar pasa id, actor y bandera al servicio', async () => {
    destacados.destacarEvento.mockResolvedValue({
      id: 1,
      destacarActivado: false,
      destacado: false,
    });

    await expect(
      controlador.destacar(1, { destacar: false }, actual),
    ).resolves.toEqual({ id: 1, destacarActivado: false, destacado: false });
    expect(destacados.destacarEvento).toHaveBeenCalledWith(1, actual, false);
  });

  it('destacar un evento es solo para cuentas Empresa', () => {
    expect(
      Reflect.getMetadata(CLAVE_ROLES, EventoController.prototype.destacar),
    ).toEqual([RoleId.Empresa]);
  });
});
