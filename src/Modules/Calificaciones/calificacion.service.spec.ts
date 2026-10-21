import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { Evento } from '../Eventos/evento.entity';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { Nodo } from '../Nodos/nodo.entity';
import { RecorridoRuta } from '../Rutas/recorrido-ruta.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { Calificacion } from './calificacion.entity';
import {
  RETIRAR_CALIFICACION,
  TipoCalificable,
  ValorCalificacion,
} from './calificacion.enum';
import { CalificacionService, claveDeArea } from './calificacion.service';

const ANA: UsuarioAutenticado = {
  id: 7,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};

const zona = (lat: number) => ({
  nombre: 'Zona',
  puntos: [
    { lat, lng: -84 },
    { lat: lat + 0.001, lng: -84 },
    { lat: lat + 0.001, lng: -84.001 },
  ],
});

const nodoEn = (parcial: Partial<Nodo> = {}): Nodo =>
  ({
    id: 3,
    lat: 10,
    lng: -84,
    estado: EstadoNodo.Aprobado,
    creadoPor: { id: 99 } as User,
    ...parcial,
  }) as Nodo;

const eventoCon = (parcial: Partial<Evento> = {}): Evento =>
  ({
    id: 5,
    areas: [zona(10), zona(11)],
    recorridos: [],
    creadoPor: { id: 99 } as User,
    ...parcial,
  }) as Evento;

describe('CalificacionService', () => {
  let service: CalificacionService;
  let filas: { clave: string; valor: ValorCalificacion; total: string }[];
  let propias: Partial<Calificacion>[];
  const calificaciones = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn((datos: Partial<Calificacion>) => datos),
    delete: jest.fn(),
  };
  const recorridos = { existsBy: jest.fn() };
  const rutas = { existsBy: jest.fn() };
  const nodos = { findOne: jest.fn() };
  const eventos = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    filas = [];
    propias = [];
    const cadena = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(() => Promise.resolve(filas)),
    };
    calificaciones.createQueryBuilder.mockReturnValue(cadena);
    calificaciones.find.mockImplementation(() => Promise.resolve(propias));
    calificaciones.update.mockResolvedValue({ affected: 1 });
    rutas.existsBy.mockResolvedValue(true);
    recorridos.existsBy.mockResolvedValue(true);

    const modulo = await Test.createTestingModule({
      providers: [
        CalificacionService,
        { provide: getRepositoryToken(Calificacion), useValue: calificaciones },
        { provide: getRepositoryToken(RecorridoRuta), useValue: recorridos },
        { provide: getRepositoryToken(Ruta), useValue: rutas },
        { provide: getRepositoryToken(Nodo), useValue: nodos },
        { provide: getRepositoryToken(Evento), useValue: eventos },
      ],
    }).compile();
    service = modulo.get(CalificacionService);
  });

  describe('rutas', () => {
    it('cuenta pulgares y marca el tuyo', async () => {
      filas = [
        { clave: '', valor: ValorCalificacion.Arriba, total: '5' },
        { clave: '', valor: ValorCalificacion.Abajo, total: '8' },
      ];
      propias = [{ clave: '', valor: ValorCalificacion.Abajo }];

      await expect(
        service.resumen(TipoCalificable.Ruta, 1, ANA),
      ).resolves.toEqual({
        arriba: 5,
        abajo: 8,
        mia: ValorCalificacion.Abajo,
        puedeCalificar: true,
        motivo: null,
      });
    });

    it('sin recorrido terminado no puede calificar', async () => {
      recorridos.existsBy.mockResolvedValue(false);

      await expect(
        service.resumen(TipoCalificable.Ruta, 1, ANA),
      ).resolves.toMatchObject({
        puedeCalificar: false,
        motivo: 'sin_recorrido',
      });
      await expect(
        service.calificar(
          TipoCalificable.Ruta,
          1,
          { valor: ValorCalificacion.Arriba },
          ANA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(calificaciones.update).not.toHaveBeenCalled();
    });

    it('404 si la ruta no existe', async () => {
      rutas.existsBy.mockResolvedValue(false);

      await expect(
        service.resumen(TipoCalificable.Ruta, 1, ANA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cambia una calificacion existente sin insertar otra', async () => {
      await service.calificar(
        TipoCalificable.Ruta,
        1,
        { valor: ValorCalificacion.Abajo },
        ANA,
      );

      expect(calificaciones.update).toHaveBeenCalledWith(
        { tipo: 'ruta', objetoId: 1, clave: '', usuarioId: 7 },
        { valor: ValorCalificacion.Abajo },
      );
      expect(calificaciones.save).not.toHaveBeenCalled();
    });

    it('inserta la primera calificacion', async () => {
      calificaciones.update.mockResolvedValue({ affected: 0 });

      await service.calificar(
        TipoCalificable.Ruta,
        1,
        { valor: ValorCalificacion.Arriba },
        ANA,
      );

      expect(calificaciones.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'ruta',
          objetoId: 1,
          usuarioId: 7,
          valor: ValorCalificacion.Arriba,
        }),
      );
    });

    it('"ninguno" retira la calificacion', async () => {
      await service.calificar(
        TipoCalificable.Ruta,
        1,
        { valor: RETIRAR_CALIFICACION },
        ANA,
      );

      expect(calificaciones.delete).toHaveBeenCalledWith({
        tipo: 'ruta',
        objetoId: 1,
        clave: '',
        usuarioId: 7,
      });
    });
  });

  describe('nodos', () => {
    it('califica a menos de 150 m', async () => {
      nodos.findOne.mockResolvedValue(nodoEn());

      await service.calificar(
        TipoCalificable.Nodo,
        3,
        { valor: ValorCalificacion.Arriba, lat: 10.0005, lng: -84 },
        ANA,
      );

      expect(calificaciones.update).toHaveBeenCalled();
    });

    it('400 si estas lejos', async () => {
      nodos.findOne.mockResolvedValue(nodoEn());

      await expect(
        service.calificar(
          TipoCalificable.Nodo,
          3,
          { valor: ValorCalificacion.Arriba, lat: 10.01, lng: -84 },
          ANA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 si no manda su posicion', async () => {
      nodos.findOne.mockResolvedValue(nodoEn());

      await expect(
        service.calificar(
          TipoCalificable.Nodo,
          3,
          { valor: ValorCalificacion.Arriba },
          ANA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('403 si el punto es tuyo', async () => {
      nodos.findOne.mockResolvedValue(nodoEn({ creadoPor: { id: 7 } as User }));

      await expect(
        service.calificar(
          TipoCalificable.Nodo,
          3,
          { valor: ValorCalificacion.Arriba, lat: 10, lng: -84 },
          ANA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.resumen(TipoCalificable.Nodo, 3, ANA),
      ).resolves.toMatchObject({ puedeCalificar: false, motivo: 'propio' });
    });

    it('403 si el punto ya no esta aprobado', async () => {
      nodos.findOne.mockResolvedValue(nodoEn({ estado: EstadoNodo.Obsoleto }));

      await expect(
        service.calificar(
          TipoCalificable.Nodo,
          3,
          { valor: ValorCalificacion.Arriba, lat: 10, lng: -84 },
          ANA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('eventos y areas', () => {
    it('separa el conteo del evento del de cada area', async () => {
      eventos.findOne.mockResolvedValue(eventoCon());
      const [primera, segunda] = [zona(10), zona(11)];
      filas = [
        { clave: '', valor: ValorCalificacion.Arriba, total: '2' },
        { clave: claveDeArea(primera), valor: ValorCalificacion.Abajo, total: '4' },
        { clave: claveDeArea(segunda), valor: ValorCalificacion.Arriba, total: '1' },
      ];
      propias = [{ clave: claveDeArea(segunda), valor: ValorCalificacion.Arriba }];

      const resumen = await service.resumen(TipoCalificable.Evento, 5, ANA);

      expect(resumen).toMatchObject({ arriba: 2, abajo: 0, mia: null });
      expect(resumen).toHaveProperty('areas', [
        expect.objectContaining({ indice: 0, arriba: 0, abajo: 4, mia: null }),
        expect.objectContaining({
          indice: 1,
          arriba: 1,
          abajo: 0,
          mia: ValorCalificacion.Arriba,
        }),
      ]);
    });

    it('califica un area con la huella de su trazo', async () => {
      eventos.findOne.mockResolvedValue(eventoCon());

      await service.calificar(
        TipoCalificable.Evento,
        5,
        { valor: ValorCalificacion.Arriba, area: 1 },
        ANA,
      );

      expect(calificaciones.update).toHaveBeenCalledWith(
        expect.objectContaining({ clave: claveDeArea(zona(11)) }),
        expect.anything(),
      );
    });

    it('400 si el area no existe', async () => {
      eventos.findOne.mockResolvedValue(eventoCon());

      await expect(
        service.calificar(
          TipoCalificable.Evento,
          5,
          { valor: ValorCalificacion.Arriba, area: 9 },
          ANA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('403 si el evento es tuyo', async () => {
      eventos.findOne.mockResolvedValue(
        eventoCon({ creadoPor: { id: 7 } as User }),
      );

      await expect(
        service.calificar(
          TipoCalificable.Evento,
          5,
          { valor: ValorCalificacion.Arriba },
          ANA,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
