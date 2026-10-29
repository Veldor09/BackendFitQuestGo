import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { UserController } from './user.controller';
import { RoleId } from './roles.enum';
import { EstadoUsuario } from './estado.enum';

describe('UserController - Auditoria administrativa', () => {
  let controller: UserController;

  let usuarios: {
    createUser: jest.Mock;
    findOneUser: jest.Mock;
    updateUser: jest.Mock;
    cambiarEstado: jest.Mock;
  };

  let auditoria: {
    registrar: jest.Mock;
  };

  let dataSource: {
    transaction: jest.Mock;
  };

  let manager: EntityManager;

  const admin = {
    id: 1,
    rol: RoleId.Admin,
  } as any;

  const normal = {
    id: 25,
    rol: RoleId.Admin + 100,
  } as any;

  beforeEach(() => {
    manager = {
      getRepository: jest.fn(),
    } as unknown as EntityManager;

    usuarios = {
      createUser: jest.fn().mockResolvedValue({ id: 25 }),
      findOneUser: jest
        .fn()
        .mockResolvedValue({ id: 25, estado: EstadoUsuario.Activado }),
      updateUser: jest
        .fn()
        .mockResolvedValue({ id: 25, estado: EstadoUsuario.Activado }),
      cambiarEstado: jest
        .fn()
        .mockResolvedValue({ id: 25, estado: EstadoUsuario.Desactivado }),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue({ id: 1 }),
    };

    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (callback: (manager: EntityManager) => Promise<unknown>) =>
            callback(manager),
        ),
    };

    controller = new UserController(
      usuarios as any,
      auditoria as any,
      dataSource as any,
    );
  });

  it('audita la creacion de usuarios dentro de una transaccion', async () => {
    const resultado = await controller.create({} as any, admin);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.createUser).toHaveBeenCalledWith({}, manager);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      {
        administradorId: 1,
        accion: 'USUARIO_CREADO',
        entidad: 'USUARIO',
        entidadId: 25,
        detalle: {
          datosRegistrados: {
            nombreUser: null,
            emailUser: null,
            telefono: null,
            idrol: null,
            estado: null,
          },
        },
      },
      manager,
    );

    expect(resultado).toEqual({ id: 25 });
  });

  it('audita las actualizaciones administrativas dentro de una transaccion', async () => {
    const resultado = await controller.update(25, {} as any, admin);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.updateUser).toHaveBeenCalledWith(25, {}, manager);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      {
        administradorId: 1,
        accion: 'USUARIO_ACTUALIZADO',
        entidad: 'USUARIO',
        entidadId: 25,
        detalle: { cambios: {} },
      },
      manager,
    );

    expect(resultado).toEqual({ id: 25, estado: EstadoUsuario.Activado });
  });

  it('no audita una actualizacion personal', async () => {
    await controller.update(25, {} as any, normal);

    expect(usuarios.updateUser).toHaveBeenCalledWith(25, {});

    expect(dataSource.transaction).not.toHaveBeenCalled();

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('audita los cambios de estado dentro de una transaccion', async () => {
    const resultado = await controller.cambiarEstado(
      25,
      {
        estado: EstadoUsuario.Desactivado,
      },
      admin,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.cambiarEstado).toHaveBeenCalledWith(
      25,
      EstadoUsuario.Desactivado,
      manager,
    );

    expect(auditoria.registrar).toHaveBeenCalledWith(
      {
        administradorId: 1,
        accion: 'ESTADO_USUARIO_CAMBIADO',
        entidad: 'USUARIO',
        entidadId: 25,
        detalle: {
          cambios: {
            estado: {
              anterior: EstadoUsuario.Activado,
              nuevo: EstadoUsuario.Desactivado,
            },
          },
        },
      },
      manager,
    );

    expect(resultado).toEqual({ id: 25, estado: EstadoUsuario.Desactivado });
  });

  it('impide que un usuario modifique otra cuenta', async () => {
    await expect(controller.update(30, {} as any, normal)).rejects.toThrow(
      ForbiddenException,
    );

    expect(usuarios.updateUser).not.toHaveBeenCalled();

    expect(dataSource.transaction).not.toHaveBeenCalled();

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('no registra operaciones que fallan', async () => {
    usuarios.updateUser.mockRejectedValue(new Error('Fallo de actualizacion'));

    await expect(controller.update(25, {} as any, admin)).rejects.toThrow(
      'Fallo de actualizacion',
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('propaga un fallo de auditoria durante la creacion', async () => {
    auditoria.registrar.mockRejectedValue(new Error('Fallo de auditoria'));

    await expect(controller.create({} as any, admin)).rejects.toThrow(
      'Fallo de auditoria',
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.createUser).toHaveBeenCalledWith({}, manager);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'USUARIO_CREADO',
        entidadId: 25,
      }),
      manager,
    );
  });

  it('propaga un fallo de auditoria durante la actualizacion', async () => {
    auditoria.registrar.mockRejectedValue(new Error('Fallo de auditoria'));

    await expect(controller.update(25, {} as any, admin)).rejects.toThrow(
      'Fallo de auditoria',
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.updateUser).toHaveBeenCalledWith(25, {}, manager);
  });

  it('propaga un fallo de auditoria durante el cambio de estado', async () => {
    auditoria.registrar.mockRejectedValue(new Error('Fallo de auditoria'));

    await expect(
      controller.cambiarEstado(
        25,
        {
          estado: EstadoUsuario.Desactivado,
        },
        admin,
      ),
    ).rejects.toThrow('Fallo de auditoria');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(usuarios.cambiarEstado).toHaveBeenCalledWith(
      25,
      EstadoUsuario.Desactivado,
      manager,
    );
  });

  it('impide que un administrador desactive su propia cuenta', async () => {
    await expect(
      controller.cambiarEstado(
        1,
        {
          estado: EstadoUsuario.Desactivado,
        },
        admin,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(usuarios.cambiarEstado).not.toHaveBeenCalled();

    expect(dataSource.transaction).not.toHaveBeenCalled();

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('impide que un administrador se quite su propio rol', async () => {
    await expect(
      controller.update(
        1,
        {
          idrol: RoleId.Admin + 100,
        } as any,
        admin,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(usuarios.updateUser).not.toHaveBeenCalled();

    expect(dataSource.transaction).not.toHaveBeenCalled();

    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
