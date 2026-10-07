import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { RoleId } from './roles.enum';
import { User } from './user.entity';
import { UserService } from './user.service';

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 1),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 2),
]);

const usuario = (parcial: Partial<User> = {}): User =>
  ({
    id: 20,
    nombreUser: 'Cafe El Roble',
    emailUser: 'cafe@x.co',
    idrol: RoleId.Empresa,
    telefono: '8888-8888',
    ...parcial,
  }) as User;

describe('UserService — perfil de empresa y foto', () => {
  let service: UserService;
  let usuarios: {
    findOneBy: jest.Mock;
    save: jest.Mock;
  };
  let fotos: { save: jest.Mock; findOne: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    usuarios = {
      findOneBy: jest.fn(),
      save: jest.fn((u: User) => Promise.resolve(u)),
    };
    fotos = {
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new UserService(
      usuarios as never,
      {} as never,
      {} as never,
      fotos as never,
    );
  });

  describe('actualizarPerfilEmpresa', () => {
    it('cambia el nombre comercial y el telefono', async () => {
      usuarios.findOneBy.mockResolvedValue(usuario());
      const r = await service.actualizarPerfilEmpresa(20, {
        nombreComercial: '  Cafe El Roble 2 S.A.  ',
        telefono: '+506 7777 7777',
      });
      expect(r.nombreUser).toBe('Cafe El Roble 2 S.A.');
      expect(r.telefono).toBe('+506 7777 7777');
    });

    it('lo que no se envia queda como estaba', async () => {
      usuarios.findOneBy.mockResolvedValue(usuario());
      const r = await service.actualizarPerfilEmpresa(20, {
        nombreComercial: 'Nuevo nombre',
      });
      expect(r.nombreUser).toBe('Nuevo nombre');
      expect(r.telefono).toBe('8888-8888');
    });

    it('un telefono vacio lo borra', async () => {
      usuarios.findOneBy.mockResolvedValue(usuario());
      const r = await service.actualizarPerfilEmpresa(20, { telefono: '' });
      expect(r.telefono).toBeNull();
    });

    it('no toca el correo ni el rol', async () => {
      usuarios.findOneBy.mockResolvedValue(usuario());
      const r = await service.actualizarPerfilEmpresa(20, {
        nombreComercial: 'X1',
      });
      expect(r.emailUser).toBe('cafe@x.co');
      expect(r.idrol).toBe(RoleId.Empresa);
    });

    it('403 si la cuenta no es de empresa', async () => {
      usuarios.findOneBy.mockResolvedValue(
        usuario({ idrol: RoleId.UserNormal }),
      );
      await expect(
        service.actualizarPerfilEmpresa(20, { nombreComercial: 'X1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(usuarios.save).not.toHaveBeenCalled();
    });

    it('404 si la cuenta no existe', async () => {
      usuarios.findOneBy.mockResolvedValue(null);
      await expect(
        service.actualizarPerfilEmpresa(99, { nombreComercial: 'X1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('guardarFoto', () => {
    beforeEach(() => usuarios.findOneBy.mockResolvedValue(usuario()));

    it('guarda un JPEG con su tipo real', async () => {
      await service.guardarFoto(20, JPEG);
      expect(fotos.save).toHaveBeenCalledWith({
        usuarioId: 20,
        contenido: JPEG,
        tipoMime: 'image/jpeg',
      });
    });

    it('guarda un PNG', async () => {
      await service.guardarFoto(20, PNG);
      expect(fotos.save).toHaveBeenCalledWith(
        expect.objectContaining({ tipoMime: 'image/png' }),
      );
    });

    it('rechaza lo que no es una imagen, aunque lo declaren asi', async () => {
      await expect(
        service.guardarFoto(20, Buffer.from('<html>no soy una foto</html>')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fotos.save).not.toHaveBeenCalled();
    });

    it('rechaza una foto de mas de 3 MB', async () => {
      const grande = Buffer.concat([JPEG, Buffer.alloc(MAX_FOTO_BYTES)]);
      await expect(service.guardarFoto(20, grande)).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      );
    });

    it('404 si la cuenta no existe', async () => {
      usuarios.findOneBy.mockResolvedValue(null);
      await expect(service.guardarFoto(99, JPEG)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('obtenerFoto / quitarFoto', () => {
    it('devuelve los bytes y el tipo', async () => {
      fotos.findOne.mockResolvedValue({
        usuarioId: 20,
        contenido: JPEG,
        tipoMime: 'image/jpeg',
      });
      await expect(service.obtenerFoto(20)).resolves.toEqual({
        contenido: JPEG,
        tipoMime: 'image/jpeg',
      });
    });

    it('404 si no tiene foto', async () => {
      fotos.findOne.mockResolvedValue(null);
      await expect(service.obtenerFoto(20)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('quitarFoto borra la fila de esa cuenta', async () => {
      await service.quitarFoto(20);
      expect(fotos.delete).toHaveBeenCalledWith({ usuarioId: 20 });
    });
  });
});
