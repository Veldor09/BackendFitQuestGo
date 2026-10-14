
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';

import { CatalogosService } from './catalogos.service';
import { CatalogoItem } from './catalogo-item.entity';

describe('CatalogosService — ADM-11', () => {
  let service: CatalogosService;

  let repositorio: {
    count: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    existsBy: jest.Mock;
  };

  const itemActivo: CatalogoItem = {
    id: 1,
    catalogo: 'alertas',
    clave: 'bache',
    nombre: 'Bache',
    activo: true,
  };

  const itemInactivo: CatalogoItem = {
    id: 2,
    catalogo: 'alertas',
    clave: 'derrumbe',
    nombre: 'Derrumbe',
    activo: false,
  };

  beforeEach(async () => {
    repositorio = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      existsBy: jest.fn(),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogosService,
        {
          provide: getRepositoryToken(CatalogoItem),
          useValue: repositorio,
        },
      ],
    }).compile();

    service = modulo.get<CatalogosService>(CatalogosService);
  });

  describe('listarCatalogos', () => {
    it('devuelve los tres catálogos permitidos', async () => {
      repositorio.count.mockResolvedValue(5);

      const resultado = await service.listarCatalogos();

      expect(resultado).toEqual([
        { catalogo: 'alertas', cantidad: 5 },
        { catalogo: 'nodos', cantidad: 5 },
        { catalogo: 'actividades', cantidad: 5 },
      ]);

      expect(repositorio.count).toHaveBeenCalledTimes(3);
    });
  });

  describe('listarItems', () => {
    it('devuelve elementos activos e inactivos para administración', async () => {
      repositorio.find.mockResolvedValue([
        itemActivo,
        itemInactivo,
      ]);

      const resultado = await service.listarItems('alertas');

      expect(resultado).toHaveLength(2);
      expect(repositorio.find).toHaveBeenCalledWith({
        where: { catalogo: 'alertas' },
        order: { id: 'ASC' },
      });
    });

    it('rechaza un catálogo no permitido', async () => {
      await expect(
        service.listarItems('usuarios'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repositorio.find).not.toHaveBeenCalled();
    });
  });

  describe('listarItemsActivos', () => {
    it('consulta exclusivamente los elementos activos', async () => {
      repositorio.find.mockResolvedValue([itemActivo]);

      const resultado = await service.listarItemsActivos('alertas');

      expect(resultado).toEqual([itemActivo]);
      expect(repositorio.find).toHaveBeenCalledWith({
        where: {
          catalogo: 'alertas',
          activo: true,
        },
        order: { id: 'ASC' },
      });
    });

    it('rechaza catálogos no permitidos', async () => {
      await expect(
        service.listarItemsActivos('administradores'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repositorio.find).not.toHaveBeenCalled();
    });

    it('devuelve una lista vacía si no existen elementos activos', async () => {
      repositorio.find.mockResolvedValue([]);

      const resultado = await service.listarItemsActivos('nodos');

      expect(resultado).toEqual([]);
    });
  });

  describe('crearItem', () => {
    it('normaliza la clave y el nombre antes de guardar', async () => {
      repositorio.findOne.mockResolvedValue(null);
      repositorio.create.mockImplementation(
        (datos: Partial<CatalogoItem>) => datos,
      );
      repositorio.save.mockImplementation(
        async (datos: Partial<CatalogoItem>) => ({
          id: 3,
          ...datos,
        }),
      );

      const resultado = await service.crearItem(
        'alertas',
        '  NUEVA_ALERTA  ',
        '  Nueva alerta  ',
      );

      expect(repositorio.create).toHaveBeenCalledWith({
        catalogo: 'alertas',
        clave: 'nueva_alerta',
        nombre: 'Nueva alerta',
        activo: true,
      });

      expect(resultado.clave).toBe('nueva_alerta');
      expect(resultado.activo).toBe(true);
    });

    it('rechaza claves duplicadas', async () => {
      repositorio.findOne.mockResolvedValue(itemActivo);

      await expect(
        service.crearItem('alertas', 'bache', 'Otro bache'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('rechaza claves con caracteres no permitidos', async () => {
      await expect(
        service.crearItem('alertas', 'clave con espacios', 'Nombre'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza nombres vacíos', async () => {
      await expect(
        service.crearItem('alertas', 'nueva_alerta', '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('editarItem', () => {
    it('permite editar el nombre sin cambiar la clave', async () => {
      repositorio.findOne.mockResolvedValue({ ...itemActivo });
      repositorio.save.mockImplementation(
        async (item: CatalogoItem) => item,
      );

      const resultado = await service.editarItem(
        'alertas',
        1,
        'Bache peligroso',
      );

      expect(resultado.nombre).toBe('Bache peligroso');
      expect(resultado.clave).toBe('bache');
      expect(resultado.activo).toBe(true);
    });

    it('permite desactivar un elemento sin eliminarlo', async () => {
      repositorio.findOne.mockResolvedValue({ ...itemActivo });
      repositorio.save.mockImplementation(
        async (item: CatalogoItem) => item,
      );

      const resultado = await service.editarItem(
        'alertas',
        1,
        'Bache',
        false,
      );

      expect(resultado.activo).toBe(false);
      expect(repositorio.save).toHaveBeenCalledTimes(1);
    });

    it('permite reactivar un elemento', async () => {
      repositorio.findOne.mockResolvedValue({ ...itemInactivo });
      repositorio.save.mockImplementation(
        async (item: CatalogoItem) => item,
      );

      const resultado = await service.editarItem(
        'alertas',
        2,
        'Derrumbe',
        true,
      );

      expect(resultado.activo).toBe(true);
    });

    it('rechaza elementos inexistentes', async () => {
      repositorio.findOne.mockResolvedValue(null);

      await expect(
        service.editarItem('alertas', 999, 'Inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza identificadores inválidos', async () => {
      await expect(
        service.editarItem('alertas', 0, 'Nombre'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('existeClaveActiva', () => {
    it('comprueba que la clave exista y esté activa', async () => {
      repositorio.existsBy.mockResolvedValue(true);

      const resultado = await service.existeClaveActiva(
        'alertas',
        'bache',
      );

      expect(resultado).toBe(true);
      expect(repositorio.existsBy).toHaveBeenCalledWith({
        catalogo: 'alertas',
        clave: 'bache',
        activo: true,
      });
    });

    it('devuelve false para una clave inactiva o inexistente', async () => {
      repositorio.existsBy.mockResolvedValue(false);

      const resultado = await service.existeClaveActiva(
        'alertas',
        'derrumbe',
      );

      expect(resultado).toBe(false);
    });
  });
});
