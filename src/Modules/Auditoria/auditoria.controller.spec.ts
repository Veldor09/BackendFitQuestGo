
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { CLAVE_ROLES } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';

import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

describe('ADM-13 - Seguridad administrativa de Auditoría', () => {
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
      getClass: () => AuditoriaController,
      getHandler: () =>
        AuditoriaController.prototype.consultar,
      switchToHttp: () => ({
        getRequest: () => solicitud,
      }),
    } as unknown as ExecutionContext;
  };

  it('debe exigir JWT y control de roles', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditoriaController,
    ) as unknown[];

    expect(guards).toContain(GuardiaJwt);
    expect(guards).toContain(GuardiaRoles);
  });

  it('debe exigir el rol administrador', () => {
    const roles = reflector.getAllAndOverride<RoleId[]>(
      CLAVE_ROLES,
      [
        AuditoriaController.prototype.consultar,
        AuditoriaController,
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

  it('debe rechazar usuarios sin permisos administrativos', () => {
    const rolesNoAdministradores = [
      RoleId.UserNormal,
      RoleId.Empresa,
    ];

    for (const rol of rolesNoAdministradores) {
      expect(() =>
        guardia.canActivate(
          crearContexto(rol),
        ),
      ).toThrow(ForbiddenException);
    }
  });

  it('debe rechazar solicitudes sin usuario autenticado', () => {
    expect(() =>
      guardia.canActivate(
        crearContexto(),
      ),
    ).toThrow(ForbiddenException);
  });

  it('debe exponer únicamente la consulta GET', () => {
    const metodos = Object.getOwnPropertyNames(
      AuditoriaController.prototype,
    ).filter((nombre) => nombre !== 'constructor');

    expect(metodos).toEqual(['consultar']);

    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        AuditoriaController,
      ),
    ).toBe('admin/auditoria');

    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AuditoriaController.prototype.consultar,
      ),
    ).toBe(0);
  });

  it('no debe permitir archivar registros', () => {
    expect(
      (AuditoriaController.prototype as unknown as
        Record<string, unknown>).archivar,
    ).toBeUndefined();

    expect(
      (AuditoriaService.prototype as unknown as
        Record<string, unknown>).archivar,
    ).toBeUndefined();
  });

  it('debe delegar la consulta al servicio', async () => {
    const filtros = {
      pagina: 1,
      limite: 20,
    };

    const respuesta = {
      registros: [],
      total: 0,
      pagina: 1,
      limite: 20,
      totalPaginas: 0,
    };

    const consultar = jest.fn().mockResolvedValue(respuesta);

    const servicio = {
      consultar,
    } as unknown as AuditoriaService;

    const controlador = new AuditoriaController(servicio);

    await expect(
      controlador.consultar(filtros),
    ).resolves.toEqual(respuesta);

    expect(consultar).toHaveBeenCalledWith(filtros);
    expect(consultar).toHaveBeenCalledTimes(1);
  });
});
