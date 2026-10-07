import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../Usuarios/user.entity';
import { UserService } from '../Usuarios/user.service';
import { ContrasenasServicio } from './services/contrasenas.service';
import { TokensServicio } from './services/tokens.service';
import { MailService } from './services/mail.service';
import { RestablecimientoContrasena } from './entities/restablecimiento-contrasena.entity';
import { RoleId } from '../Usuarios/roles.enum';

describe('AuthService — recuperacion de contrasena', () => {
  let service: AuthService;
  let usuarios: jest.Mocked<Pick<Repository<User>, 'findOne' | 'update'>>;
  let restablecimientos: jest.Mocked<
    Pick<Repository<RestablecimientoContrasena>, 'findOne' | 'save' | 'update'>
  > & {
    create: jest.Mock<
      RestablecimientoContrasena,
      [DeepPartial<RestablecimientoContrasena>]
    >;
  };
  let mail: jest.Mocked<Pick<MailService, 'enviarCodigoRecuperacion'>>;
  let contrasenas: jest.Mocked<
    Pick<ContrasenasServicio, 'hashear' | 'verificar'>
  >;
  let tokens: jest.Mocked<Pick<TokensServicio, 'revocarTodasDelUsuario'>>;

  beforeEach(async () => {
    usuarios = { findOne: jest.fn(), update: jest.fn() };
    restablecimientos = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x as RestablecimientoContrasena),
      update: jest.fn(),
    };
    mail = { enviarCodigoRecuperacion: jest.fn().mockResolvedValue(undefined) };
    contrasenas = {
      hashear: jest.fn().mockResolvedValue('hash-nuevo'),
      verificar: jest.fn(),
    };
    tokens = { revocarTodasDelUsuario: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usuarios },
        {
          provide: getRepositoryToken(RestablecimientoContrasena),
          useValue: restablecimientos,
        },
        { provide: UserService, useValue: {} },
        { provide: ContrasenasServicio, useValue: contrasenas },
        { provide: TokensServicio, useValue: tokens },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('olvideContrasena', () => {
    it('no hace nada si el correo no existe, pero no lanza', async () => {
      usuarios.findOne.mockResolvedValue(null);
      await expect(
        service.olvideContrasena('no-existe@x.co'),
      ).resolves.toBeUndefined();
      expect(mail.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('genera codigo, lo guarda hasheado y envia el correo si el usuario existe', async () => {
      usuarios.findOne.mockResolvedValue({
        id: 5,
        emailUser: 'ana@x.co',
      } as User);
      await service.olvideContrasena('ana@x.co');

      expect(restablecimientos.save).toHaveBeenCalledTimes(1);
      const guardado = restablecimientos.save.mock
        .calls[0][0] as RestablecimientoContrasena;
      expect(guardado.usuarioId).toBe(5);
      expect(guardado.usado).toBe(false);
      expect(guardado.hashCodigo).toHaveLength(64); // sha256 hex

      expect(mail.enviarCodigoRecuperacion).toHaveBeenCalledTimes(1);
      expect(mail.enviarCodigoRecuperacion.mock.calls[0][0]).toBe('ana@x.co');
      const codigoEnviado = mail.enviarCodigoRecuperacion.mock.calls[0][1];
      expect(codigoEnviado).toMatch(/^\d{6}$/);
    });
  });

  describe('restablecerContrasena', () => {
    it('lanza UnauthorizedException si no hay usuario con ese correo', async () => {
      usuarios.findOne.mockResolvedValue(null);
      await expect(
        service.restablecerContrasena({
          email: 'no-existe@x.co',
          codigo: '123456',
          nuevaContrasena: 'nueva12345',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza UnauthorizedException si no hay restablecimiento vigente que matchee', async () => {
      usuarios.findOne.mockResolvedValue({
        id: 5,
        emailUser: 'ana@x.co',
      } as User);
      restablecimientos.findOne.mockResolvedValue(null);
      await expect(
        service.restablecerContrasena({
          email: 'ana@x.co',
          codigo: '000000',
          nuevaContrasena: 'nueva12345',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el restablecimiento esta expirado', async () => {
      usuarios.findOne.mockResolvedValue({
        id: 5,
        emailUser: 'ana@x.co',
      } as User);
      restablecimientos.findOne.mockResolvedValue({
        id: 9,
        usuarioId: 5,
        usado: false,
        expiraEn: new Date(Date.now() - 1_000), // ya vencido
      } as RestablecimientoContrasena);

      await expect(
        service.restablecerContrasena({
          email: 'ana@x.co',
          codigo: '123456',
          nuevaContrasena: 'nueva12345',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('actualiza la contrasena y marca el restablecimiento como usado', async () => {
      usuarios.findOne.mockResolvedValue({
        id: 5,
        emailUser: 'ana@x.co',
      } as User);
      restablecimientos.findOne.mockResolvedValue({
        id: 9,
        usuarioId: 5,
        usado: false,
        expiraEn: new Date(Date.now() + 60_000),
      } as RestablecimientoContrasena);

      await service.restablecerContrasena({
        email: 'ana@x.co',
        codigo: '123456',
        nuevaContrasena: 'nueva12345',
      });

      expect(contrasenas.hashear).toHaveBeenCalledWith('nueva12345');
      expect(usuarios.update).toHaveBeenCalledWith(
        { id: 5 },
        { passwordUserHash: 'hash-nuevo' },
      );
      expect(restablecimientos.update).toHaveBeenCalledWith(
        { id: 9 },
        { usado: true },
      );
      expect(tokens.revocarTodasDelUsuario).toHaveBeenCalledWith(5);
    });
  });
});

describe('AuthService — registro de empresa', () => {
  let service: AuthService;
  let userService: { createUser: jest.Mock };
  let tokens: {
    firmarAccessToken: jest.Mock;
    emitirRefreshToken: jest.Mock;
  };

  beforeEach(async () => {
    userService = {
      createUser: jest.fn().mockImplementation((dto: Partial<User>) =>
        Promise.resolve({
          id: 9,
          nombreUser: dto.nombreUser,
          emailUser: dto.emailUser,
          idrol: dto.idrol,
        } as User),
      ),
    };
    tokens = {
      firmarAccessToken: jest.fn().mockResolvedValue('jwt'),
      emitirRefreshToken: jest.fn().mockResolvedValue({
        tokenPlano: 'refresh',
        expiraEn: new Date('2030-01-01'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: getRepositoryToken(RestablecimientoContrasena),
          useValue: {},
        },
        { provide: UserService, useValue: userService },
        { provide: ContrasenasServicio, useValue: {} },
        { provide: TokensServicio, useValue: tokens },
        { provide: MailService, useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('crea el usuario con rol Empresa, nombre comercial sin espacios sobrantes y telefono', async () => {
    const resultado = await service.registrarEmpresa(
      {
        nombreComercial: '  Cafe El Roble  ',
        email: 'contacto@elroble.co',
        contrasena: 'contrasena123',
        telefono: '8888-8888',
        aceptaTerminos: true,
      },
      {},
    );

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        nombreUser: 'Cafe El Roble',
        emailUser: 'contacto@elroble.co',
        passwordUserHash: 'contrasena123',
        idrol: RoleId.Empresa,
        telefono: '8888-8888',
        terminosAceptadosEn: expect.any(Date) as Date,
      }),
    );
    expect(resultado.usuario).toEqual({
      id: 9,
      nombre: 'Cafe El Roble',
      email: 'contacto@elroble.co',
      rol: RoleId.Empresa,
    });
    expect(tokens.firmarAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 9, rol: RoleId.Empresa }),
    );
  });

  it('no deja que un registro de empresa pida otro rol', async () => {
    await service.registrarEmpresa(
      {
        nombreComercial: 'Taller Bici',
        email: 'a@b.co',
        contrasena: 'contrasena123',
        aceptaTerminos: true,
        // @ts-expect-error el DTO no tiene `idrol`; simula un cuerpo manipulado
        idrol: 3,
      },
      {},
    );
    const enviado = userService.createUser.mock.calls[0][0] as {
      idrol: number;
    };
    expect(enviado.idrol).toBe(RoleId.Empresa);
  });
});
