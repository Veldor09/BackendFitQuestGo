
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { CLAVE_ROLES } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';

import {
  AdminInsigniasController,
  InsigniasController,
  UsuarioInsigniasController,
} from './insignias.controller';
import { InsigniasService } from './insignias.service';

describe('ADM-10 - Seguridad administrativa de insignias', () => {
  const reflector = new Reflector();
  const guardia = new GuardiaRoles(reflector);

  const crearContexto = (
    rol?: RoleId,
  ): ExecutionContext => {
    const solicitud = {
      usuario:
        rol === undefined
          ? undefined
          : { id: 10, rol },
    };

    return {
      getClass: () => AdminInsigniasController,
      getHandler: () =>
        AdminInsigniasController.prototype.listar,
      switchToHttp: () => ({
        getRequest: () => solicitud,
      }),
    } as unknown as ExecutionContext;
  };

  it('debe exigir JWT y control de roles', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminInsigniasController,
    ) as unknown[];

    expect(guards).toContain(GuardiaJwt);
    expect(guards).toContain(GuardiaRoles);
  });

  it('debe exigir el rol administrador', () => {
    const roles = reflector.getAllAndOverride<RoleId[]>(
      CLAVE_ROLES,
      [
        AdminInsigniasController.prototype.listar,
        AdminInsigniasController,
      ],
    );

    expect(roles).toEqual([RoleId.Admin]);
  });

  it('debe permitir el acceso al administrador', () => {
    expect(
      guardia.canActivate(
        crearContexto(RoleId.Admin),
      ),
    ).toBe(true);
  });

  it('debe rechazar a un usuario sin rol administrador', () => {
    const rolNoAdministrador = Object.values(RoleId).find(
      (rol) => rol !== RoleId.Admin,
    );

    expect(rolNoAdministrador).toBeDefined();

    expect(() =>
      guardia.canActivate(
        crearContexto(rolNoAdministrador),
      ),
    ).toThrow(ForbiddenException);
  });

  it('debe rechazar solicitudes sin usuario autenticado', () => {
    expect(() =>
      guardia.canActivate(
        crearContexto(),
      ),
    ).toThrow(ForbiddenException);
  });

  it('debe proteger los cuatro métodos administrativos', () => {
    const metodos = [
      'listar',
      'obtener',
      'crear',
      'editar',
    ] as const;

    for (const metodo of metodos) {
      const roles = reflector.getAllAndOverride<RoleId[]>(
        CLAVE_ROLES,
        [
          AdminInsigniasController.prototype[metodo],
          AdminInsigniasController,
        ],
      );

      expect(roles).toContain(RoleId.Admin);
    }
  });

  it('debe conservar los controladores de usuario', () => {
    expect(
      InsigniasController.prototype.obtenerMias,
    ).toBeDefined();

    expect(
      UsuarioInsigniasController.prototype.obtenerDeUsuario,
    ).toBeDefined();
  });

  it('debe delegar el listado al servicio administrativo', async () => {
    const insignias = [
      { id: 1, codigo: 'RUTAS_5' },
    ];

    const servicio = {
      listarAdministracion: jest.fn().mockResolvedValue(
        insignias,
      ),
    } as unknown as InsigniasService;

    const controlador = new AdminInsigniasController(
      servicio,
    );

    await expect(
      controlador.listar(),
    ).resolves.toEqual(insignias);

    expect(
      servicio.listarAdministracion,
    ).toHaveBeenCalledTimes(1);
  });

  it('debe delegar la consulta por ID al servicio', async () => {
    const insignia = {
      id: 5,
      codigo: 'KM_25',
    };

    const servicio = {
      obtenerAdministracion: jest.fn().mockResolvedValue(
        insignia,
      ),
    } as unknown as InsigniasService;

    const controlador = new AdminInsigniasController(
      servicio,
    );

    await expect(
      controlador.obtener(5),
    ).resolves.toEqual(insignia);

    expect(
      servicio.obtenerAdministracion,
    ).toHaveBeenCalledWith(5);
  });
});
