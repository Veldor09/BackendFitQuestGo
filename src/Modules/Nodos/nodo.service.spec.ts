import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeepPartial, In, QueryFailedError } from 'typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { CategoriaNodo } from './categoria-nodo.enum';
import { CrearNodoDto } from './dto/NodoDTO';
import { EstadoNodo, TipoVotoNodo, UMBRAL_OBSOLETO } from './estado-nodo.enum';
import { MAX_FOTO_BYTES } from './imagen.util';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { InsigniasService } from '../Insignias/insignias.service';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { Nodo } from './nodo.entity';
import { NodoService } from './nodo.service';

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 1),
]);

const AUTOR = 7;
const dueno: UsuarioAutenticado = {
  id: AUTOR,
  email: 'a@x.co',
  rol: RoleId.UserNormal,
};
const otro: UsuarioAutenticado = {
  id: 99,
  email: 'b@x.co',
  rol: RoleId.UserNormal,
};
const admin: UsuarioAutenticado = {
  id: 1,
  email: 'adm@x.co',
  rol: RoleId.Admin,
};

const nodo = (parcial: Partial<Nodo> = {}): Nodo => ({
  id: 5,
  nombre: 'Fuente',
  categoria: CategoriaNodo.Agua,
  categoriaOtro: null,
  lat: 9.93,
  lng: -84.09,
  descripcion: null,
  estado: EstadoNodo.Pendiente,
  conFoto: false,
  creadoPor: { id: AUTOR, nombreUser: 'Ana', emailUser: 'ana@x.co' } as User,
  creadoEn: new Date(),
  ...parcial,
});

const QUIEN_VOTA = 42;
const NODO_LAT = 9.93;
const NODO_LNG = -84.09;

// 1 grado de latitud ~ 111.2 km, asi que los desplazamientos son ~m al norte.
const alNorte = (grados: number) => ({
  lat: NODO_LAT + grados,
  lng: NODO_LNG,
});
const CERCA = alNorte(0.0005); // ~56 m
const JUSTO_DENTRO = alNorte(0.0013); // ~145 m
const JUSTO_FUERA = alNorte(0.0014); // ~156 m
const LEJOS = alNorte(0.01); // ~1.1 km

const aprobado = (parcial: Partial<Nodo> = {}): Nodo =>
  nodo({ estado: EstadoNodo.Aprobado, ...parcial });

const votoDe = (usuarioId: number, tipo: TipoVotoNodo, nodoId = 5): NodoVoto =>
  ({ id: usuarioId, nodoId, usuarioId, tipo }) as NodoVoto;

/** Lo que lanza TypeORM cuando Postgres rechaza una fila repetida (23505). */
const violacionDeUnicidad = () =>
  new QueryFailedError(
    'INSERT INTO "nodo_votos"',
    [],
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    }),
  );

describe('NodoService', () => {
  let service: NodoService;
  let notificacionesService: { crear: jest.Mock };
  let nodos: {
    findOne: jest.Mock<Promise<Nodo | null>, [unknown]>;
    save: jest.Mock<Promise<Nodo>, [Nodo]>;
    create: jest.Mock<Nodo, [DeepPartial<Nodo>]>;
    createQueryBuilder: jest.Mock<unknown, [string]>;
  };
  let fotos: {
    findOne: jest.Mock<Promise<NodoFoto | null>, [unknown]>;
    save: jest.Mock<Promise<NodoFoto>, [DeepPartial<NodoFoto>]>;
  };
  let votos: {
    find: jest.Mock<Promise<NodoVoto[]>, [unknown]>;
    save: jest.Mock<Promise<NodoVoto>, [NodoVoto]>;
    create: jest.Mock<NodoVoto, [DeepPartial<NodoVoto>]>;
  };

  beforeEach(async () => {
    notificacionesService = { crear: jest.fn().mockResolvedValue({}) };
    nodos = {
      findOne: jest.fn<Promise<Nodo | null>, [unknown]>(),
      save: jest.fn((n: Nodo) => Promise.resolve(n)),
      create: jest.fn((n: DeepPartial<Nodo>) => n as Nodo),
      createQueryBuilder: jest.fn<unknown, [string]>(),
    };
    votos = {
      find: jest.fn<Promise<NodoVoto[]>, [unknown]>().mockResolvedValue([]),
      save: jest.fn((v: NodoVoto) => Promise.resolve(v)),
      create: jest.fn((v: DeepPartial<NodoVoto>) => v as NodoVoto),
    };
    fotos = {
      findOne: jest.fn<Promise<NodoFoto | null>, [unknown]>(),
      save: jest.fn((f: DeepPartial<NodoFoto>) =>
        Promise.resolve(f as NodoFoto),
      ),
    };
    const modulo = await Test.createTestingModule({
      providers: [
        NodoService,
        { provide: getRepositoryToken(Nodo), useValue: nodos },
        { provide: getRepositoryToken(NodoFoto), useValue: fotos },
        { provide: getRepositoryToken(NodoVoto), useValue: votos },
        {
          provide: InsigniasService,
          useValue: { evaluar: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificacionesService,
          useValue: notificacionesService,
        },
      ],
    }).compile();
    service = modulo.get(NodoService);
  });

  describe('create', () => {
    const dto = (parcial: Partial<CrearNodoDto> = {}): CrearNodoDto => ({
      nombre: 'Fuente',
      categoria: CategoriaNodo.Agua,
      lat: 9.93,
      lng: -84.09,
      ...parcial,
    });

    it('guarda el texto "otro" solo cuando la categoria es otro', async () => {
      await service.create(
        dto({ categoria: CategoriaNodo.Otro, categoriaOtro: 'Picnic' }),
        AUTOR,
      );
      expect(nodos.create.mock.calls[0][0]).toMatchObject({
        categoria: CategoriaNodo.Otro,
        categoriaOtro: 'Picnic',
        estado: EstadoNodo.Pendiente,
      });
    });

    it('descarta el texto "otro" si la categoria es del catalogo', async () => {
      await service.create(dto({ categoriaOtro: 'lo que sea' }), AUTOR);
      expect(nodos.create.mock.calls[0][0]).toMatchObject({
        categoria: CategoriaNodo.Agua,
        categoriaOtro: null,
      });
    });

    it('notifica al usuario cuando se crea el punto de interés y queda en revisión', async () => {
      const nuevoNodo = nodo({ id: 50, nombre: 'Mirador del Sol' });
      nodos.save.mockResolvedValueOnce(nuevoNodo);

      await service.create(dto({ nombre: 'Mirador del Sol' }), AUTOR);

      expect(notificacionesService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          idUsuario: AUTOR,
          categoria: CategoriaNotificacion.Eventos,
          titulo: 'Punto de interés enviado a revisión',
          referenciaTipo: ReferenciaTipoNotificacion.Nodo,
          referenciaId: 50,
        }),
      );
    });
  });

  describe('cambiarEstado', () => {
    it('notifica al autor cuando el punto de interés es aprobado', async () => {
      const nodoExistente = nodo({
        id: 55,
        nombre: 'Taller Comunitario',
        estado: EstadoNodo.Pendiente,
      });
      nodos.findOne.mockResolvedValueOnce(nodoExistente);

      await service.cambiarEstado(55, EstadoNodo.Aprobado);

      expect(notificacionesService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          idUsuario: AUTOR,
          categoria: CategoriaNotificacion.Eventos,
          titulo: '¡Tu punto de interés "Taller Comunitario" fue aprobado!',
          referenciaTipo: ReferenciaTipoNotificacion.Nodo,
          referenciaId: 55,
        }),
      );
    });

    it('notifica al autor cuando el punto de interés es rechazado', async () => {
      const nodoExistente = nodo({
        id: 56,
        nombre: 'Punto Inexistente',
        estado: EstadoNodo.Pendiente,
      });
      nodos.findOne.mockResolvedValueOnce(nodoExistente);

      await service.cambiarEstado(56, EstadoNodo.Rechazado);

      expect(notificacionesService.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          idUsuario: AUTOR,
          categoria: CategoriaNotificacion.Eventos,
          titulo: 'Tu punto de interés "Punto Inexistente" no fue aprobado',
          referenciaTipo: ReferenciaTipoNotificacion.Nodo,
          referenciaId: 56,
        }),
      );
    });
  });

  describe('guardarFoto', () => {
    it('404 si el nodo no existe', async () => {
      nodos.findOne.mockResolvedValue(null);
      await expect(service.guardarFoto(5, JPEG, dueno)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('403 si no es tu nodo y no sos admin', async () => {
      nodos.findOne.mockResolvedValue(nodo());
      await expect(service.guardarFoto(5, JPEG, otro)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fotos.save).not.toHaveBeenCalled();
    });

    it('el dueño la sube: guarda los bytes, el tipo real y marca conFoto', async () => {
      nodos.findOne.mockResolvedValue(nodo());

      const resultado = await service.guardarFoto(5, JPEG, dueno);

      expect(fotos.save).toHaveBeenCalledTimes(1);
      const guardada = fotos.save.mock.calls[0][0];
      expect(guardada.nodoId).toBe(5);
      expect(guardada.tipoMime).toBe('image/jpeg');
      expect(guardada.contenido).toBe(JPEG);
      expect(resultado.conFoto).toBe(true);
    });

    it('un admin tambien puede', async () => {
      nodos.findOne.mockResolvedValue(nodo());
      await expect(service.guardarFoto(5, JPEG, admin)).resolves.toBeDefined();
    });

    it('400 si no es una imagen real, aunque diga serlo', async () => {
      nodos.findOne.mockResolvedValue(nodo());
      await expect(
        service.guardarFoto(5, Buffer.from('<?php evil(); ?>'), dueno),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fotos.save).not.toHaveBeenCalled();
    });

    it('413 si pesa mas del maximo', async () => {
      nodos.findOne.mockResolvedValue(nodo());
      const enorme = Buffer.concat([JPEG, Buffer.alloc(MAX_FOTO_BYTES)]);
      await expect(
        service.guardarFoto(5, enorme, dueno),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });
  });

  describe('obtenerFoto', () => {
    const foto = (): NodoFoto =>
      ({ nodoId: 5, contenido: JPEG, tipoMime: 'image/jpeg' }) as NodoFoto;

    it('404 si el nodo no tiene foto', async () => {
      nodos.findOne.mockResolvedValue(nodo({ estado: EstadoNodo.Aprobado }));
      fotos.findOne.mockResolvedValue(null);
      await expect(service.obtenerFoto(5, otro)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un nodo aprobado lo ve cualquier usuario', async () => {
      nodos.findOne.mockResolvedValue(nodo({ estado: EstadoNodo.Aprobado }));
      fotos.findOne.mockResolvedValue(foto());
      await expect(service.obtenerFoto(5, otro)).resolves.toMatchObject({
        tipoMime: 'image/jpeg',
      });
    });

    it('uno pendiente solo lo ven su dueño y el admin', async () => {
      nodos.findOne.mockResolvedValue(nodo({ estado: EstadoNodo.Pendiente }));
      fotos.findOne.mockResolvedValue(foto());

      await expect(service.obtenerFoto(5, dueno)).resolves.toBeDefined();
      await expect(service.obtenerFoto(5, admin)).resolves.toBeDefined();
      await expect(service.obtenerFoto(5, otro)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('votar (confirmar / marcar obsoleto)', () => {
    it('404 si el punto no existe', async () => {
      nodos.findOne.mockResolvedValue(null);
      await expect(
        service.confirmar(5, QUIEN_VOTA, CERCA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(votos.save).not.toHaveBeenCalled();
    });

    it.each([EstadoNodo.Pendiente, EstadoNodo.Rechazado, EstadoNodo.Obsoleto])(
      '409 si el punto esta %s: solo se vota lo que esta en el mapa',
      async (estado) => {
        nodos.findOne.mockResolvedValue(nodo({ estado }));
        await expect(
          service.marcarObsoleto(5, QUIEN_VOTA, CERCA),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(votos.save).not.toHaveBeenCalled();
      },
    );

    it('403 si el punto lo propusiste vos', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      await expect(service.confirmar(5, AUTOR, CERCA)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(votos.save).not.toHaveBeenCalled();
    });

    it('400 si estas lejos y no registra nada', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      await expect(
        service.confirmar(5, QUIEN_VOTA, LEJOS),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(votos.save).not.toHaveBeenCalled();
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('el 400 dice a cuantos metros estas', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      await expect(
        service.marcarObsoleto(5, QUIEN_VOTA, JUSTO_FUERA),
      ).rejects.toThrow(/156 m/);
    });

    it('acepta el voto justo dentro del radio de 150 m', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(QUIEN_VOTA, TipoVotoNodo.Confirmar),
      ]);
      await expect(
        service.confirmar(5, QUIEN_VOTA, JUSTO_DENTRO),
      ).resolves.toBeDefined();
    });

    it('409 si ya habias votado ese punto', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.save.mockRejectedValue(violacionDeUnicidad());
      await expect(
        service.confirmar(5, QUIEN_VOTA, CERCA),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('no esconde otros errores de la base de datos', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      const caida = new Error('conexion perdida');
      votos.save.mockRejectedValue(caida);
      await expect(service.confirmar(5, QUIEN_VOTA, CERCA)).rejects.toBe(caida);
    });

    it('confirmar guarda el voto y devuelve el recuento con tu voto', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(10, TipoVotoNodo.Confirmar),
        votoDe(QUIEN_VOTA, TipoVotoNodo.Confirmar),
      ]);

      const resultado = await service.confirmar(5, QUIEN_VOTA, CERCA);

      expect(votos.create).toHaveBeenCalledWith({
        nodoId: 5,
        usuarioId: QUIEN_VOTA,
        tipo: TipoVotoNodo.Confirmar,
      });
      expect(votos.save).toHaveBeenCalledTimes(1);
      expect(resultado.confirmaciones).toBe(2);
      expect(resultado.obsoletos).toBe(0);
      expect(resultado.miVoto).toBe(TipoVotoNodo.Confirmar);
      expect(resultado.estado).toBe(EstadoNodo.Aprobado);
    });

    it('la respuesta no expone el correo de quien propuso el punto', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(QUIEN_VOTA, TipoVotoNodo.Confirmar),
      ]);

      const resultado = await service.confirmar(5, QUIEN_VOTA, CERCA);

      expect(resultado.creadoPor).toEqual({ id: AUTOR, nombreUser: 'Ana' });
    });

    it('marcar obsoleto bajo el umbral deja el punto en el mapa', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(10, TipoVotoNodo.Obsoleto),
        votoDe(QUIEN_VOTA, TipoVotoNodo.Obsoleto),
      ]);

      const resultado = await service.marcarObsoleto(5, QUIEN_VOTA, CERCA);

      expect(resultado.obsoletos).toBe(2);
      expect(resultado.miVoto).toBe(TipoVotoNodo.Obsoleto);
      expect(resultado.estado).toBe(EstadoNodo.Aprobado);
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('al llegar al umbral de obsoletos lo retira del mapa', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(10, TipoVotoNodo.Obsoleto),
        votoDe(11, TipoVotoNodo.Obsoleto),
        votoDe(QUIEN_VOTA, TipoVotoNodo.Obsoleto),
      ]);
      expect(UMBRAL_OBSOLETO).toBe(3);

      const resultado = await service.marcarObsoleto(5, QUIEN_VOTA, CERCA);

      expect(resultado.estado).toBe(EstadoNodo.Obsoleto);
      expect(nodos.save).toHaveBeenCalledTimes(1);
      expect(nodos.save.mock.calls[0][0].estado).toBe(EstadoNodo.Obsoleto);
    });

    it('si las confirmaciones empatan los obsoletos, sigue en el mapa', async () => {
      nodos.findOne.mockResolvedValue(aprobado());
      votos.find.mockResolvedValue([
        votoDe(10, TipoVotoNodo.Obsoleto),
        votoDe(11, TipoVotoNodo.Obsoleto),
        votoDe(QUIEN_VOTA, TipoVotoNodo.Obsoleto),
        votoDe(20, TipoVotoNodo.Confirmar),
        votoDe(21, TipoVotoNodo.Confirmar),
        votoDe(22, TipoVotoNodo.Confirmar),
      ]);

      const resultado = await service.marcarObsoleto(5, QUIEN_VOTA, CERCA);

      expect(resultado.estado).toBe(EstadoNodo.Aprobado);
      expect(nodos.save).not.toHaveBeenCalled();
    });
  });

  describe('findAprobados', () => {
    const constructorDeConsulta = (puntos: Nodo[]) => {
      const consulta = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(puntos),
      };
      nodos.createQueryBuilder.mockReturnValue(consulta);
      return consulta;
    };

    it('adjunta a cada punto el recuento de votos y el voto de quien consulta', async () => {
      constructorDeConsulta([aprobado({ id: 5 }), aprobado({ id: 6 })]);
      votos.find.mockResolvedValue([
        votoDe(10, TipoVotoNodo.Confirmar, 5),
        votoDe(11, TipoVotoNodo.Obsoleto, 5),
        votoDe(QUIEN_VOTA, TipoVotoNodo.Obsoleto, 5),
      ]);

      const resultado = await service.findAprobados(QUIEN_VOTA);

      expect(
        resultado.map((n) => [n.id, n.confirmaciones, n.obsoletos, n.miVoto]),
      ).toEqual([
        [5, 1, 2, TipoVotoNodo.Obsoleto],
        [6, 0, 0, null],
      ]);
      expect(votos.find).toHaveBeenCalledWith({
        where: { nodoId: In([5, 6]) },
      });
    });

    it('tampoco expone el correo del autor en el listado', async () => {
      constructorDeConsulta([aprobado({ id: 5 })]);

      const [punto] = await service.findAprobados(QUIEN_VOTA);

      expect(punto.creadoPor).toEqual({ id: AUTOR, nombreUser: 'Ana' });
    });

    it('sin puntos no consulta votos', async () => {
      constructorDeConsulta([]);
      await expect(service.findAprobados(QUIEN_VOTA)).resolves.toEqual([]);
      expect(votos.find).not.toHaveBeenCalled();
    });
  });
});
