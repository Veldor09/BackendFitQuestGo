import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeepPartial } from 'typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { CategoriaNodo } from './categoria-nodo.enum';
import { EstadoNodo } from './estado-nodo.enum';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { Nodo } from './nodo.entity';
import { NodoService } from './nodo.service';

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
const ADMIN: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};

const creadoPorEmpresa = {
  id: 21,
  nombreUser: 'Otra empresa',
  idrol: RoleId.Empresa,
} as User;
const creadoPorDeportista = {
  id: 7,
  nombreUser: 'Ana',
  idrol: RoleId.UserNormal,
} as User;

const nodo = (creadoPor: User, parcial: Partial<Nodo> = {}): Nodo => ({
  id: 5,
  nombre: 'Punto',
  categoria: CategoriaNodo.Agua,
  categoriaOtro: null,
  lat: 9.93,
  lng: -84.09,
  descripcion: null,
  beneficio: null,
  patrocinado: false,
  estado: EstadoNodo.Aprobado,
  conFoto: true,
  creadoPor,
  creadoEn: new Date(),
  ...parcial,
});

describe('NodoService — una empresa no ve los nodos de los deportistas', () => {
  let service: NodoService;
  let nodos: {
    findOne: jest.Mock<Promise<Nodo | null>, [unknown]>;
    save: jest.Mock<Promise<Nodo>, [Nodo]>;
    create: jest.Mock<Nodo, [DeepPartial<Nodo>]>;
    createQueryBuilder: jest.Mock;
  };
  let fotos: { findOne: jest.Mock };
  let votos: { find: jest.Mock; save: jest.Mock; create: jest.Mock };

  const consultaFalsa = (resultado: Nodo[] = []) => {
    const consulta = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(resultado),
    };
    nodos.createQueryBuilder.mockReturnValue(consulta);
    return consulta;
  };

  beforeEach(async () => {
    nodos = {
      findOne: jest.fn<Promise<Nodo | null>, [unknown]>(),
      save: jest.fn((n: Nodo) => Promise.resolve(n)),
      create: jest.fn((n: DeepPartial<Nodo>) => n as Nodo),
      createQueryBuilder: jest.fn(),
    };
    fotos = { findOne: jest.fn() };
    votos = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((v: NodoVoto) => Promise.resolve(v)),
      create: jest.fn((v: DeepPartial<NodoVoto>) => v as NodoVoto),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        NodoService,
        { provide: getRepositoryToken(Nodo), useValue: nodos },
        { provide: getRepositoryToken(NodoFoto), useValue: fotos },
        { provide: getRepositoryToken(NodoVoto), useValue: votos },
      ],
    }).compile();
    service = modulo.get(NodoService);
  });

  describe('findAprobados (el mapa)', () => {
    it('para una empresa filtra por nodos creados por empresas', async () => {
      const consulta = consultaFalsa();
      await service.findAprobados(EMPRESA.id, EMPRESA.rol);
      expect(consulta.andWhere).toHaveBeenCalledWith(
        'creadoPor.idrol = :rolEmpresa',
        { rolEmpresa: RoleId.Empresa },
      );
    });

    it('para un deportista NO filtra: ve los de deportistas y los de empresas', async () => {
      const consulta = consultaFalsa();
      await service.findAprobados(DEPORTISTA.id, DEPORTISTA.rol);
      expect(consulta.andWhere).not.toHaveBeenCalled();
    });

    it('para un admin tampoco filtra', async () => {
      const consulta = consultaFalsa();
      await service.findAprobados(ADMIN.id, ADMIN.rol);
      expect(consulta.andWhere).not.toHaveBeenCalled();
    });

    it('sin rol (llamada interna) no filtra', async () => {
      const consulta = consultaFalsa();
      await service.findAprobados(DEPORTISTA.id);
      expect(consulta.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('verNodo (GET /nodos/:id)', () => {
    it('una empresa ve el nodo de otra empresa', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorEmpresa));
      await expect(service.verNodo(5, EMPRESA)).resolves.toMatchObject({
        id: 5,
      });
    });

    it('una empresa NO ve el nodo de un deportista: 404, como si no existiera', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorDeportista));
      await expect(service.verNodo(5, EMPRESA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un deportista ve el nodo de una empresa y el de otro deportista', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorEmpresa));
      await expect(service.verNodo(5, DEPORTISTA)).resolves.toBeDefined();
      nodos.findOne.mockResolvedValue(nodo(creadoPorDeportista));
      await expect(service.verNodo(5, DEPORTISTA)).resolves.toBeDefined();
    });

    it('404 si el nodo no existe', async () => {
      nodos.findOne.mockResolvedValue(null);
      await expect(service.verNodo(5, EMPRESA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('foto', () => {
    const foto = { contenido: Buffer.from([1]), tipoMime: 'image/jpeg' };

    it('una empresa NO baja la foto de un nodo de un deportista', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorDeportista));
      fotos.findOne.mockResolvedValue(foto);
      await expect(service.obtenerFoto(5, EMPRESA)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fotos.findOne).not.toHaveBeenCalled();
    });

    it('una empresa si baja la foto de un nodo aprobado de otra empresa', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorEmpresa));
      fotos.findOne.mockResolvedValue(foto);
      await expect(service.obtenerFoto(5, EMPRESA)).resolves.toEqual(foto);
    });

    it('un deportista baja la foto de un nodo de empresa', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorEmpresa));
      fotos.findOne.mockResolvedValue(foto);
      await expect(service.obtenerFoto(5, DEPORTISTA)).resolves.toEqual(foto);
    });
  });

  describe('votar', () => {
    const cerca = { lat: 9.93, lng: -84.09 };

    it('una empresa NO puede votar un nodo de un deportista', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorDeportista));
      await expect(
        service.confirmar(5, EMPRESA.id, cerca, EMPRESA.rol),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.marcarObsoleto(5, EMPRESA.id, cerca, EMPRESA.rol),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(votos.save).not.toHaveBeenCalled();
    });

    it('una empresa si puede votar el nodo de otra empresa', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorEmpresa));
      await expect(
        service.confirmar(5, EMPRESA.id, cerca, EMPRESA.rol),
      ).resolves.toBeDefined();
      expect(votos.save).toHaveBeenCalledTimes(1);
    });

    it('un deportista sigue votando nodos de deportistas', async () => {
      nodos.findOne.mockResolvedValue(nodo(creadoPorDeportista, { id: 5 }));
      await expect(
        service.confirmar(5, 42, cerca, DEPORTISTA.rol),
      ).resolves.toBeDefined();
    });
  });
});
