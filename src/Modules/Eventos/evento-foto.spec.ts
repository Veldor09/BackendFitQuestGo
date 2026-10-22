import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { EventoFoto } from './evento-foto.entity';
import { Evento } from './evento.entity';
import { EventoService } from './evento.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const EMPRESA: UsuarioAutenticado = {
  id: 20,
  email: 'cafe@x.co',
  rol: RoleId.Empresa,
};
const OTRA: UsuarioAutenticado = {
  id: 21,
  email: 'bici@x.co',
  rol: RoleId.Empresa,
};
const DEPORTISTA: UsuarioAutenticado = {
  id: 7,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};

const evento = (): Evento =>
  ({
    id: 3,
    nombre: 'Caminata',
    conFoto: false,
    areas: [],
    recorridos: [],
    creadoPor: { id: 20 } as User,
  }) as unknown as Evento;

describe('EventoService — foto del evento', () => {
  let service: EventoService;
  const eventos = { findOne: jest.fn(), save: jest.fn() };
  const fotos = { save: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    eventos.save.mockImplementation((e: Evento) => Promise.resolve(e));
    const modulo = await Test.createTestingModule({
      providers: [
        EventoService,
        { provide: getRepositoryToken(Evento), useValue: eventos },
        { provide: getRepositoryToken(EventoFoto), useValue: fotos },
      ],
    }).compile();
    service = modulo.get(EventoService);
  });

  it('la empresa dueña guarda la foto y el evento queda con foto', async () => {
    eventos.findOne.mockResolvedValue(evento());

    const guardado = await service.guardarFoto(3, JPEG, EMPRESA);

    expect(fotos.save).toHaveBeenCalledWith({
      eventoId: 3,
      contenido: JPEG,
      tipoMime: 'image/jpeg',
    });
    expect(guardado.conFoto).toBe(true);
  });

  it('403 si el evento es de otra empresa', async () => {
    eventos.findOne.mockResolvedValue(evento());

    await expect(service.guardarFoto(3, JPEG, OTRA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(fotos.save).not.toHaveBeenCalled();
  });

  it('400 si no es una imagen y 413 si pesa demasiado', async () => {
    eventos.findOne.mockResolvedValue(evento());

    await expect(
      service.guardarFoto(3, Buffer.from('texto'), EMPRESA),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.guardarFoto(3, Buffer.alloc(MAX_FOTO_BYTES + 1), EMPRESA),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('cualquier usuario ve la foto del evento', async () => {
    eventos.findOne.mockResolvedValue(evento());
    fotos.findOne.mockResolvedValue({ contenido: JPEG, tipoMime: 'image/jpeg' });

    await expect(service.obtenerFoto(3)).resolves.toEqual({
      contenido: JPEG,
      tipoMime: 'image/jpeg',
    });
    expect(DEPORTISTA.id).toBe(7);
  });

  it('404 si el evento no tiene foto o no existe', async () => {
    eventos.findOne.mockResolvedValue(evento());
    fotos.findOne.mockResolvedValue(null);
    await expect(service.obtenerFoto(3)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    eventos.findOne.mockResolvedValue(null);
    await expect(service.obtenerFoto(3)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
