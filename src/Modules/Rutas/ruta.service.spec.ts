import { NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { ActividadRuta } from './actividad-ruta.enum';
import { EstadoRuta } from './estado-ruta.enum';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

const DUENO = 7;
const dueno: UsuarioAutenticado = {
  id: DUENO,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};
const otra: UsuarioAutenticado = {
  id: 99,
  email: 'luis@x.co',
  rol: RoleId.UserNormal,
};
const admin: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};

const ruta = (estado: EstadoRuta): Ruta =>
  Object.assign(new Ruta(), {
    id: 5,
    nombre: 'Sendero',
    actividades: [ActividadRuta.Running],
    dificultad: 'moderada',
    distanciaKm: 5,
    puntos: [{ lat: 9.93, lng: -84.09 }],
    estado,
    creadoPor: { id: DUENO } as User,
    creadoEn: new Date(),
  });

describe('RutaService.verRuta (GET /rutas/:id)', () => {
  let service: RutaService;
  let rutas: { findOne: jest.Mock<Promise<Ruta | null>, [unknown]> };

  beforeEach(() => {
    rutas = { findOne: jest.fn<Promise<Ruta | null>, [unknown]>() };
    // Se arma a mano: el servicio puede recibir mas repositorios (p. ej. el de
    // rutas favoritas) y aca solo se usa el de rutas.
    service = new (
      RutaService as unknown as new (rutas: unknown) => RutaService
    )(rutas);
  });

  it('404 si la ruta no existe', async () => {
    rutas.findOne.mockResolvedValue(null);
    await expect(service.verRuta(5, otra)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('una ruta publicada la ve cualquier usuario', async () => {
    rutas.findOne.mockResolvedValue(ruta(EstadoRuta.Publicada));
    await expect(service.verRuta(5, otra)).resolves.toMatchObject({ id: 5 });
  });

  it.each([EstadoRuta.Privada, EstadoRuta.Pendiente, EstadoRuta.Rechazada])(
    'una ruta %s no la ve otra persona: 404, como si no existiera',
    async (estado) => {
      rutas.findOne.mockResolvedValue(ruta(estado));
      await expect(service.verRuta(5, otra)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

  it.each([
    EstadoRuta.Privada,
    EstadoRuta.Pendiente,
    EstadoRuta.Publicada,
    EstadoRuta.Rechazada,
  ])('quien la creo ve la suya en estado %s', async (estado) => {
    rutas.findOne.mockResolvedValue(ruta(estado));
    await expect(service.verRuta(5, dueno)).resolves.toMatchObject({ id: 5 });
  });

  it.each([
    EstadoRuta.Privada,
    EstadoRuta.Pendiente,
    EstadoRuta.Publicada,
    EstadoRuta.Rechazada,
  ])('el admin ve una ruta %s (para moderar)', async (estado) => {
    rutas.findOne.mockResolvedValue(ruta(estado));
    await expect(service.verRuta(5, admin)).resolves.toMatchObject({ id: 5 });
  });
});
