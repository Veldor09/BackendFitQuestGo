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
