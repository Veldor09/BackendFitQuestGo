import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeepPartial } from 'typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { CategoriaNodo } from './categoria-nodo.enum';
import { CrearNodoDto } from './dto/NodoDTO';
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
const OTRA_EMPRESA: UsuarioAutenticado = {
  id: 21,
  email: 'bici@x.co',
  rol: RoleId.Empresa,
};
const ADMIN: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};

const nodoDeEmpresa = (parcial: Partial<Nodo> = {}): Nodo => ({
  id: 8,
  nombre: 'Cafe El Roble',
  categoria: CategoriaNodo.Restaurante,
  categoriaOtro: null,
  lat: 9.93,
  lng: -84.09,
  descripcion: null,
  beneficio: '10% de descuento',
  patrocinado: true,
  estado: EstadoNodo.Aprobado,
  conFoto: false,
  creadoPor: { id: EMPRESA.id, nombreUser: 'Cafe El Roble' } as User,
  creadoEn: new Date(),
  ...parcial,
});

const dto = (parcial: Partial<CrearNodoDto> = {}): CrearNodoDto => ({
  nombre: 'Cafe El Roble',
  categoria: CategoriaNodo.Restaurante,
  lat: 9.93,
  lng: -84.09,
  ...parcial,
});

describe('NodoService — nodos patrocinados (modulo 5)', () => {
  let service: NodoService;
  let nodos: {
    findOne: jest.Mock<Promise<Nodo | null>, [unknown]>;
    save: jest.Mock<Promise<Nodo>, [Nodo]>;
    create: jest.Mock<Nodo, [DeepPartial<Nodo>]>;
    remove: jest.Mock<Promise<Nodo>, [Nodo]>;
  };

  beforeEach(async () => {
    nodos = {
      findOne: jest.fn<Promise<Nodo | null>, [unknown]>(),
      save: jest.fn((n: Nodo) => Promise.resolve(n)),
      create: jest.fn((n: DeepPartial<Nodo>) => n as Nodo),
      remove: jest.fn((n: Nodo) => Promise.resolve(n)),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        NodoService,
        { provide: getRepositoryToken(Nodo), useValue: nodos },
        { provide: getRepositoryToken(NodoFoto), useValue: {} },
        { provide: getRepositoryToken(NodoVoto), useValue: {} },
      ],
    }).compile();
    service = modulo.get(NodoService);
  });

  describe('create', () => {
    it('una empresa publica directo, como patrocinado y con su beneficio', async () => {
      await service.create(
        dto({ beneficio: '  Cafe gratis con tu ruta  ' }),
        EMPRESA.id,
        EMPRESA.rol,
      );
      expect(nodos.create.mock.calls[0][0]).toMatchObject({
        estado: EstadoNodo.Aprobado,
        patrocinado: true,
        beneficio: 'Cafe gratis con tu ruta',
      });
    });

    it('un beneficio en blanco se guarda como null', async () => {
      await service.create(dto({ beneficio: '   ' }), EMPRESA.id, EMPRESA.rol);
      expect(nodos.create.mock.calls[0][0]).toMatchObject({ beneficio: null });
    });

    it('un deportista tambien publica directo, pero sin patrocinio ni beneficio', async () => {
      await service.create(
        dto({ beneficio: 'me lo invento' }),
        7,
        RoleId.UserNormal,
      );
      expect(nodos.create.mock.calls[0][0]).toMatchObject({
        estado: EstadoNodo.Aprobado,
        patrocinado: false,
        beneficio: null,
      });
    });

    it('sin rol (llamada interna) se trata como deportista', async () => {
      await service.create(dto(), 7);
      expect(nodos.create.mock.calls[0][0]).toMatchObject({
        estado: EstadoNodo.Aprobado,
        patrocinado: false,
      });
    });
  });

  describe('actualizar', () => {
    it('la empresa dueña cambia nombre y beneficio', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      const actualizado = await service.actualizar(
        8,
        { nombre: 'Cafe Nuevo', beneficio: '2x1 en cafe' },
        EMPRESA,
      );
      expect(actualizado).toMatchObject({
        nombre: 'Cafe Nuevo',
        beneficio: '2x1 en cafe',
      });
    });

    it('puede quitar el beneficio con un texto vacio', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      const actualizado = await service.actualizar(
        8,
        { beneficio: '' },
        EMPRESA,
      );
      expect(actualizado.beneficio).toBeNull();
    });

    it('una descripcion vacia la borra', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa({ descripcion: 'vieja' }));
      const actualizado = await service.actualizar(
        8,
        { descripcion: '  ' },
        EMPRESA,
      );
      expect(actualizado.descripcion).toBeNull();
    });

    it('no toca la categoria "otro" si no se envia categoria', async () => {
      nodos.findOne.mockResolvedValue(
        nodoDeEmpresa({
          categoria: CategoriaNodo.Otro,
          categoriaOtro: 'Picnic',
        }),
      );
      const actualizado = await service.actualizar(8, { nombre: 'X' }, EMPRESA);
      expect(actualizado.categoriaOtro).toBe('Picnic');
    });

    it('limpia categoriaOtro al pasar a una categoria del catalogo', async () => {
      nodos.findOne.mockResolvedValue(
        nodoDeEmpresa({
          categoria: CategoriaNodo.Otro,
          categoriaOtro: 'Picnic',
        }),
      );
      const actualizado = await service.actualizar(
        8,
        { categoria: CategoriaNodo.Agua },
        EMPRESA,
      );
      expect(actualizado.categoriaOtro).toBeNull();
    });

    it('403 si el nodo es de otra empresa', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      await expect(
        service.actualizar(8, { nombre: 'X' }, OTRA_EMPRESA),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('403 si el nodo no es patrocinado, aunque sea del mismo usuario', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa({ patrocinado: false }));
      await expect(
        service.actualizar(8, { nombre: 'X' }, EMPRESA),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('eliminar', () => {
    it('la empresa dueña lo da de baja', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      await service.eliminar(8, EMPRESA);
      expect(nodos.remove).toHaveBeenCalledTimes(1);
    });

    it('un admin tambien', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      await service.eliminar(8, ADMIN);
      expect(nodos.remove).toHaveBeenCalledTimes(1);
    });

    it('403 para otra empresa', async () => {
      nodos.findOne.mockResolvedValue(nodoDeEmpresa());
      await expect(service.eliminar(8, OTRA_EMPRESA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(nodos.remove).not.toHaveBeenCalled();
    });

    it('403 para un deportista que propuso un punto normal (no es patrocinado)', async () => {
      nodos.findOne.mockResolvedValue(
        nodoDeEmpresa({
          patrocinado: false,
          creadoPor: { id: 7, nombreUser: 'Ana' } as User,
        }),
      );
      await expect(
        service.eliminar(8, { id: 7, email: 'a@x.co', rol: RoleId.UserNormal }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
