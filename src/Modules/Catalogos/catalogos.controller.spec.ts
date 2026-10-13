
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { CLAVE_ROLES } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';

describe('CatalogosController — ADM-11', () => {
  let controller: CatalogosController;

  let servicio: {
    listarCatalogos: jest.Mock;
    listarItems: jest.Mock;
    listarItemsActivos: jest.Mock;
    crearItem: jest.Mock;
    editarItem: jest.Mock;
  };

  beforeEach(async () => {
    servicio = {
      listarCatalogos: jest.fn(),
      listarItems: jest.fn(),
      listarItemsActivos: jest.fn(),
      crearItem: jest.fn(),
      editarItem: jest.fn(),
    };

    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [CatalogosController],
      providers: [
        {
          provide: CatalogosService,
          useValue: servicio,
        },
      ],
    })
      .overrideGuard(GuardiaJwt)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(GuardiaRoles)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = modulo.get<CatalogosController>(
      CatalogosController,
    );
  });

  describe('protección del controlador', () => {
    it('declara los guardias JWT y de roles', () => {
      const guardias = Reflect.getMetadata(
        GUARDS_METADATA,
        CatalogosController,
      ) as unknown[];

      expect(guardias).toContain(GuardiaJwt);
      expect(guardias).toContain(GuardiaRoles);
    });

    it('restringe por defecto las operaciones al administrador', () => {
      const reflector = new Reflector();

      const metodosAdministrativos = [
        controller.listarCatalogos,
        controller.listarItems,
        controller.crearItem,
        controller.editarItem,
      ];

      for (const metodo of metodosAdministrativos) {
        const roles = reflector.getAllAndOverride<RoleId[]>(
          CLAVE_ROLES,
          [metodo, CatalogosController],
        );

        expect(roles).toEqual([RoleId.Admin]);
      }
    });

    it('permite consultar activos a los tres roles autenticados', () => {
      const reflector = new Reflector();

      const roles = reflector.getAllAndOverride<RoleId[]>(
        CLAVE_ROLES,
        [
          controller.listarItemsActivos,
          CatalogosController,
        ],
      );

      expect(roles).toEqual([
        RoleId.UserNormal,
        RoleId.Empresa,
        RoleId.Admin,
      ]);
    });
  });

  describe('consultas', () => {
    it('delega el listado de catálogos al servicio', async () => {
      const datos = [{ catalogo: 'alertas', cantidad: 10 }];
      servicio.listarCatalogos.mockResolvedValue(datos);

      await expect(
        controller.listarCatalogos(),
      ).resolves.toEqual(datos);

      expect(servicio.listarCatalogos).toHaveBeenCalledTimes(1);
    });

    it('delega el listado administrativo de elementos', async () => {
      const datos = [
        {
          id: 1,
          catalogo: 'alertas',
          clave: 'bache',
          nombre: 'Bache',
          activo: true,
        },
        {
          id: 2,
          catalogo: 'alertas',
          clave: 'derrumbe',
          nombre: 'Derrumbe',
          activo: false,
        },
      ];

      servicio.listarItems.mockResolvedValue(datos);

      await expect(
        controller.listarItems('alertas'),
      ).resolves.toEqual(datos);

      expect(servicio.listarItems).toHaveBeenCalledWith(
        'alertas',
      );
    });

    it('delega la consulta de elementos activos', async () => {
      const datos = [
        {
          id: 1,
          catalogo: 'alertas',
          clave: 'bache',
          nombre: 'Bache',
          activo: true,
        },
      ];

      servicio.listarItemsActivos.mockResolvedValue(datos);

      await expect(
        controller.listarItemsActivos('alertas'),
      ).resolves.toEqual(datos);

      expect(servicio.listarItemsActivos).toHaveBeenCalledWith(
        'alertas',
      );

      expect(servicio.listarItems).not.toHaveBeenCalled();
    });
  });

  describe('administración', () => {
    it('delega la creación con clave y nombre', async () => {
      const creado = {
        id: 3,
        catalogo: 'alertas',
        clave: 'nueva_alerta',
        nombre: 'Nueva alerta',
        activo: true,
      };

      servicio.crearItem.mockResolvedValue(creado);

      await expect(
        controller.crearItem('alertas', {
          clave: 'nueva_alerta',
          nombre: 'Nueva alerta',
        }),
      ).resolves.toEqual(creado);

      expect(servicio.crearItem).toHaveBeenCalledWith(
        'alertas',
        'nueva_alerta',
        'Nueva alerta',
      );
    });

    it('delega la edición del nombre y estado activo', async () => {
      const editado = {
        id: 1,
        catalogo: 'alertas',
        clave: 'bache',
        nombre: 'Bache actualizado',
        activo: false,
      };

      servicio.editarItem.mockResolvedValue(editado);

      await expect(
        controller.editarItem('alertas', 1, {
          nombre: 'Bache actualizado',
          activo: false,
        }),
      ).resolves.toEqual(editado);

      expect(servicio.editarItem).toHaveBeenCalledWith(
        'alertas',
        1,
        'Bache actualizado',
        false,
      );
    });
  });
});
