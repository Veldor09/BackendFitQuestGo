import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeepPartial, FindOperator } from 'typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { CategoriaEvento } from './categoria-evento.enum';
import { CrearEventoDto } from './dto/EventoDTO';
import { Evento } from './evento.entity';
import { EventoService } from './evento.service';

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
const ADMIN: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};
const DEPORTISTA: UsuarioAutenticado = {
  id: 7,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};

const HORA = 3_600_000;
const enHoras = (h: number): Date => new Date(Date.now() + h * HORA);

const area = (nombre = 'Zona de salida') => ({
  nombre,
  puntos: [
    { lat: 10, lng: -84 },
    { lat: 10.001, lng: -84 },
    { lat: 10.001, lng: -84.001 },
  ],
});
const recorrido = (nombre = 'Caminata 5k') => ({
  nombre,
  puntos: [
    { lat: 10, lng: -84 },
    { lat: 10.002, lng: -84.002 },
  ],
});

const dto = (parcial: Partial<CrearEventoDto> = {}): CrearEventoDto => ({
  nombre: 'Evento Benefico',
  categoria: CategoriaEvento.Benefico,
  fechaInicio: enHoras(24),
  fechaFin: enHoras(28),
  areas: [area()],
  recorridos: [recorrido()],
  ...parcial,
});

const evento = (parcial: Partial<Evento> = {}): Evento => ({
  id: 3,
  nombre: 'Evento Benefico',
  descripcion: null,
  categoria: CategoriaEvento.Benefico,
  fechaInicio: enHoras(24),
  fechaFin: enHoras(28),
  areas: [area()],
  recorridos: [recorrido()],
  creadoPor: { id: EMPRESA.id, nombreUser: 'Cafe El Roble' } as User,
  creadoEn: new Date(),
  ...parcial,
});

describe('EventoService', () => {
  let service: EventoService;
  let eventos: {
    find: jest.Mock<Promise<Evento[]>, [unknown]>;
    findOne: jest.Mock<Promise<Evento | null>, [unknown]>;
    save: jest.Mock<Promise<Evento>, [Evento]>;
    create: jest.Mock<Evento, [DeepPartial<Evento>]>;
    remove: jest.Mock<Promise<Evento>, [Evento]>;
  };

  beforeEach(async () => {
    eventos = {
      find: jest.fn<Promise<Evento[]>, [unknown]>().mockResolvedValue([]),
      findOne: jest.fn<Promise<Evento | null>, [unknown]>(),
      save: jest.fn((e: Evento) => Promise.resolve(e)),
      create: jest.fn((e: DeepPartial<Evento>) => e as Evento),
      remove: jest.fn((e: Evento) => Promise.resolve(e)),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        EventoService,
        { provide: getRepositoryToken(Evento), useValue: eventos },
      ],
    }).compile();
    service = modulo.get(EventoService);
  });

  describe('create', () => {
    it('guarda el evento con sus areas y recorridos a nombre de la empresa', async () => {
      await service.create(
        dto({ nombre: '  Evento Benefico  ', descripcion: ' Por la escuela ' }),
        EMPRESA.id,
      );
      const guardado = eventos.create.mock.calls[0][0];
      expect(guardado).toMatchObject({
        nombre: 'Evento Benefico',
        descripcion: 'Por la escuela',
        categoria: CategoriaEvento.Benefico,
        creadoPor: { id: EMPRESA.id },
      });
      expect(guardado.areas).toHaveLength(1);
      expect(guardado.recorridos).toHaveLength(1);
      expect(eventos.save).toHaveBeenCalledTimes(1);
    });

    it('admite un evento con solo un recorrido, o con solo un area', async () => {
      await expect(
        service.create(dto({ areas: undefined }), EMPRESA.id),
      ).resolves.toBeDefined();
      await expect(
        service.create(dto({ recorridos: undefined }), EMPRESA.id),
      ).resolves.toBeDefined();
    });

    it('admite varias areas y varios recorridos', async () => {
      await service.create(
        dto({
          areas: [area('Salida'), area('Meta')],
          recorridos: [recorrido('5k'), recorrido('10k'), recorrido('21k')],
        }),
        EMPRESA.id,
      );
      const guardado = eventos.create.mock.calls[0][0];
      expect(guardado.areas).toHaveLength(2);
      expect(guardado.recorridos).toHaveLength(3);
    });

    it('rechaza un evento sin area ni recorrido', async () => {
      await expect(
        service.create(dto({ areas: [], recorridos: [] }), EMPRESA.id),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(
          dto({ areas: undefined, recorridos: undefined }),
          EMPRESA.id,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventos.save).not.toHaveBeenCalled();
    });

    it('rechaza una fecha de fin igual o anterior a la de inicio', async () => {
      const inicio = enHoras(24);
      await expect(
        service.create(dto({ fechaInicio: inicio, fechaFin: inicio }), 20),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(dto({ fechaInicio: inicio, fechaFin: enHoras(20) }), 20),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un evento que ya termino', async () => {
      await expect(
        service.create(
          dto({ fechaInicio: enHoras(-48), fechaFin: enHoras(-24) }),
          20,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta un evento que ya empezo pero no ha terminado', async () => {
      await expect(
        service.create(
          dto({ fechaInicio: enHoras(-2), fechaFin: enHoras(2) }),
          20,
        ),
      ).resolves.toBeDefined();
    });

    it('guarda solo lat y lng de cada punto, sin propiedades de mas', async () => {
      const conExtra = {
        nombre: 'Salida',
        puntos: [
          { lat: 10, lng: -84, extra: 'x' },
          { lat: 10.1, lng: -84, extra: 'y' },
          { lat: 10.1, lng: -84.1, extra: 'z' },
        ],
      };
      await service.create(dto({ areas: [conExtra] }), EMPRESA.id);
      const punto = eventos.create.mock.calls[0][0].areas?.[0]?.puntos?.[0];
      expect(punto).toEqual({ lat: 10, lng: -84 });
    });
  });

  describe('findVigentes / findMios', () => {
    it('lista solo lo que no ha terminado, el mas proximo primero', async () => {
      await service.findVigentes();
      const opciones = eventos.find.mock.calls[0][0] as {
        where: { fechaFin: FindOperator<Date> };
        order: Record<string, string>;
      };
      expect(opciones.where.fechaFin.type).toBe('moreThanOrEqual');
      expect(opciones.order.fechaInicio).toBe('ASC');
    });

    it('la empresa ve todos los suyos, tambien los terminados', async () => {
      await service.findMios(EMPRESA.id);
      expect(eventos.find.mock.calls[0][0]).toMatchObject({
        where: { creadoPor: { id: EMPRESA.id } },
      });
    });
  });

  describe('findOne', () => {
    it('404 si no existe', async () => {
      eventos.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('actualizar', () => {
    it('cambia solo lo que se envia', async () => {
      eventos.findOne.mockResolvedValue(evento());
      const actualizado = await service.actualizar(
        3,
        { nombre: 'Caminata Nueva' },
        EMPRESA,
      );
      expect(actualizado.nombre).toBe('Caminata Nueva');
      expect(actualizado.areas).toHaveLength(1);
      expect(actualizado.recorridos).toHaveLength(1);
    });

    it('permite quitar el area si queda al menos un recorrido', async () => {
      eventos.findOne.mockResolvedValue(evento());
      const actualizado = await service.actualizar(3, { areas: [] }, EMPRESA);
      expect(actualizado.areas).toHaveLength(0);
    });

    it('no permite dejar el evento sin area ni recorrido', async () => {
      eventos.findOne.mockResolvedValue(evento());
      await expect(
        service.actualizar(3, { areas: [], recorridos: [] }, EMPRESA),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventos.save).not.toHaveBeenCalled();
    });

    it('valida las fechas contra las que ya tenia el evento', async () => {
      const existente = evento({ fechaInicio: enHoras(24) });
      eventos.findOne.mockResolvedValue(existente);
      await expect(
        service.actualizar(3, { fechaFin: enHoras(10) }, EMPRESA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('403 si el evento es de otra empresa', async () => {
      eventos.findOne.mockResolvedValue(evento());
      await expect(
        service.actualizar(3, { nombre: 'X' }, OTRA),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventos.save).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('la empresa dueña lo borra', async () => {
      eventos.findOne.mockResolvedValue(evento());
      await service.eliminar(3, EMPRESA);
      expect(eventos.remove).toHaveBeenCalledTimes(1);
    });

    it('un admin puede borrar el de cualquier empresa', async () => {
      eventos.findOne.mockResolvedValue(evento());
      await service.eliminar(3, ADMIN);
      expect(eventos.remove).toHaveBeenCalledTimes(1);
    });

    it('403 para otra empresa y para un deportista', async () => {
      eventos.findOne.mockResolvedValue(evento());
      await expect(service.eliminar(3, OTRA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.eliminar(3, DEPORTISTA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(eventos.remove).not.toHaveBeenCalled();
    });
  });
});
