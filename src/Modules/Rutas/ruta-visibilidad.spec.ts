import { NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { ActividadRuta } from './actividad-ruta.enum';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

const EMPRESA: UsuarioAutenticado = {
  id: 20,
  email: 'cafe@x.co',
  rol: RoleId.Empresa,
};
const DEPORTISTA: UsuarioAutenticado = {
  id: 7,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};

const deEmpresa = { id: 21, idrol: RoleId.Empresa } as User;
const deDeportista = { id: 7, idrol: RoleId.UserNormal } as User;

const ruta = (id: number, creadoPor: User): Ruta =>
  Object.assign(new Ruta(), {
    id,
    nombre: `Ruta ${id}`,
    actividades: [ActividadRuta.Running],
    dificultad: 'moderada',
    distanciaKm: 5,
    puntos: [{ lat: 9.93, lng: -84.09 }],
    estado: EstadoRuta.Publicada,
    creadoPor,
    creadoEn: new Date(),
  });

describe('RutaService — una empresa no ve las rutas de los deportistas', () => {
  let service: RutaService;
  let rutas: {
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let favoritas: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const consultaFalsa = () => {
    const consulta = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    rutas.createQueryBuilder.mockReturnValue(consulta);
    return consulta;
  };

  beforeEach(() => {
    rutas = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    favoritas = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((f: Partial<RutaFavorita>) => f),
      save: jest.fn(),
      remove: jest.fn(),
    };
    service = new RutaService(rutas as never, favoritas as never);
  });

  describe('findPublicadas (Explorar)', () => {
    it('para una empresa filtra por rutas creadas por empresas', async () => {
      const consulta = consultaFalsa();
      await service.findPublicadas(EMPRESA.rol);
      expect(consulta.andWhere).toHaveBeenCalledWith(
        'creadoPor.idrol = :rolEmpresa',
        { rolEmpresa: RoleId.Empresa },
      );
    });

    it('para un deportista no filtra', async () => {
      const consulta = consultaFalsa();
      await service.findPublicadas(DEPORTISTA.rol);
      expect(consulta.andWhere).not.toHaveBeenCalled();
    });

    it('sin rol no filtra', async () => {
      const consulta = consultaFalsa();
      await service.findPublicadas();
      expect(consulta.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('verRuta', () => {
    it('una empresa ve una ruta publicada de otra empresa', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deEmpresa));
      await expect(service.verRuta(5, EMPRESA)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('una empresa NO ve una ruta publicada de un deportista: 404', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deDeportista));
      await expect(service.verRuta(5, EMPRESA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un deportista ve la ruta publicada de una empresa', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deEmpresa));
      await expect(service.verRuta(5, DEPORTISTA)).resolves.toBeDefined();
    });
  });

  describe('findFavoritas', () => {
    beforeEach(() => {
      favoritas.find.mockResolvedValue([
        { usuarioId: 20, rutaId: 1 },
        { usuarioId: 20, rutaId: 2 },
      ]);
      rutas.find.mockResolvedValue([ruta(1, deEmpresa), ruta(2, deDeportista)]);
    });

    it('a una empresa le quita las de deportistas', async () => {
      const r = await service.findFavoritas(EMPRESA.id, EMPRESA.rol);
      expect(r.map((x) => x.id)).toEqual([1]);
    });

    it('a un deportista le deja todas', async () => {
      const r = await service.findFavoritas(DEPORTISTA.id, DEPORTISTA.rol);
      expect(r.map((x) => x.id)).toEqual([1, 2]);
    });

    it('sin rol deja todas', async () => {
      const r = await service.findFavoritas(DEPORTISTA.id);
      expect(r).toHaveLength(2);
    });
  });

  describe('toggleFavorita', () => {
    it('una empresa NO puede guardar la ruta de un deportista: 404', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deDeportista));
      await expect(
        service.toggleFavorita(5, EMPRESA.id, EMPRESA.rol),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(favoritas.save).not.toHaveBeenCalled();
    });

    it('una empresa si guarda la ruta de otra empresa', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deEmpresa));
      await expect(
        service.toggleFavorita(5, EMPRESA.id, EMPRESA.rol),
      ).resolves.toEqual({ favorita: true });
    });

    it('un deportista guarda cualquiera', async () => {
      rutas.findOne.mockResolvedValue(ruta(5, deDeportista));
      await expect(
        service.toggleFavorita(5, DEPORTISTA.id, DEPORTISTA.rol),
      ).resolves.toEqual({ favorita: true });
    });
  });
});
