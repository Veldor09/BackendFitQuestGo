import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DeepPartial,
  In,
  LessThanOrEqual,
  QueryFailedError,
  UpdateResult,
} from 'typeorm';
import { User } from '../Usuarios/user.entity';
import { AlertaVoto } from './alerta-voto.entity';
import { Alerta } from './alerta.entity';
import { AlertaService } from './alerta.service';
import { InsigniasService } from '../Insignias/insignias.service';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CrearAlertaDto } from './dto/AlertaDTO';
import {
  EstadoAlerta,
  GravedadAlerta,
  TipoVotoAlerta,
  UMBRAL_DESMENTIDOS,
} from './estado-alerta.enum';
import { TipoAlerta } from './tipo-alerta.enum';

const ALERTA_LAT = 9.9281;
const ALERTA_LNG = -84.0907;
const USUARIO_ID = 42;

// 1 grado de latitud ~ 111.2 km, asi que los desplazamientos son ~m al norte.
const alNorte = (grados: number) => ({
  lat: ALERTA_LAT + grados,
  lng: ALERTA_LNG,
});
const CERCA = alNorte(0.0005); // ~56 m
const JUSTO_DENTRO = alNorte(0.0013); // ~145 m
const JUSTO_FUERA = alNorte(0.0014); // ~156 m
const LEJOS = alNorte(0.01); // ~1.1 km

const alertaActiva = (parcial: Partial<Alerta> = {}): Alerta => ({
  id: 7,
  tipo: TipoAlerta.Bache,
  tipoOtro: null,
  gravedad: GravedadAlerta.Media,
  lat: ALERTA_LAT,
  lng: ALERTA_LNG,
  descripcion: null,
  estado: EstadoAlerta.Activa,
  confirmacionesNo: 0,
  creadoPor: { id: 1 } as User,
  creadoEn: new Date(),
  expiraEn: new Date(Date.now() + 60 * 60 * 1000),
  ...parcial,
});

/** Lo que lanza TypeORM cuando Postgres rechaza una fila repetida (23505). */
const violacionDeUnicidad = () =>
  new QueryFailedError(
    'INSERT INTO "alerta_votos"',
    [],
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    }),
  );

describe('AlertaService — un voto por persona y solo si estas cerca', () => {
  let service: AlertaService;
  let alertas: {
    find: jest.Mock<Promise<Alerta[]>, [unknown]>;
    findOne: jest.Mock<Promise<Alerta | null>, [unknown]>;
    save: jest.Mock<Promise<Alerta>, [Alerta]>;
    create: jest.Mock<Alerta, [DeepPartial<Alerta>]>;
    update: jest.Mock<Promise<UpdateResult>, [unknown, unknown]>;
  };
  let votos: {
    find: jest.Mock<Promise<AlertaVoto[]>, [unknown]>;
    save: jest.Mock<Promise<AlertaVoto>, [AlertaVoto]>;
    create: jest.Mock<AlertaVoto, [DeepPartial<AlertaVoto>]>;
  };

  beforeEach(async () => {
    alertas = {
      find: jest.fn<Promise<Alerta[]>, [unknown]>(),
      findOne: jest.fn<Promise<Alerta | null>, [unknown]>(),
      save: jest.fn((a: Alerta) => Promise.resolve(a)),
      create: jest.fn((a: DeepPartial<Alerta>) => a as Alerta),
      update: jest.fn<Promise<UpdateResult>, [unknown, unknown]>(),
    };
    votos = {
      find: jest.fn<Promise<AlertaVoto[]>, [unknown]>().mockResolvedValue([]),
      save: jest.fn((v: AlertaVoto) => Promise.resolve(v)),
      create: jest.fn((v: DeepPartial<AlertaVoto>) => v as AlertaVoto),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        AlertaService,
        { provide: getRepositoryToken(Alerta), useValue: alertas },
        { provide: getRepositoryToken(AlertaVoto), useValue: votos },
        {
          provide: InsigniasService,
          useValue: { evaluar: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotificacionesService,
          useValue: { crear: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    service = modulo.get(AlertaService);
  });

  describe('create', () => {
    const dto = (parcial: Partial<CrearAlertaDto> = {}): CrearAlertaDto => ({
      tipo: TipoAlerta.Bache,
      gravedad: GravedadAlerta.Media,
      lat: ALERTA_LAT,
      lng: ALERTA_LNG,
      ...parcial,
    });

    it('guarda el texto "otro" solo cuando el tipo es otro', async () => {
      await service.create(
        dto({ tipo: TipoAlerta.Otro, tipoOtro: 'Poste inclinado' }),
        USUARIO_ID,
      );
      expect(alertas.create.mock.calls[0][0]).toMatchObject({
        tipo: TipoAlerta.Otro,
        tipoOtro: 'Poste inclinado',
        estado: EstadoAlerta.Activa,
      });
    });

    it('descarta el texto "otro" si el tipo es del catalogo', async () => {
      await service.create(dto({ tipoOtro: 'lo que sea' }), USUARIO_ID);
      expect(alertas.create.mock.calls[0][0]).toMatchObject({
        tipo: TipoAlerta.Bache,
        tipoOtro: null,
      });
    });

    it.each([
      [GravedadAlerta.Baja, 2],
      [GravedadAlerta.Media, 6],
      [GravedadAlerta.Alta, 24],
    ])('una alerta %s nace con %i h de vigencia', async (gravedad, horas) => {
      const antes = Date.now();

      await service.create(dto({ gravedad }), USUARIO_ID);

      const despues = Date.now();
      const vence = (
        alertas.create.mock.calls[0][0].expiraEn as Date
      ).getTime();
      expect(vence).toBeGreaterThanOrEqual(antes + horas * 3_600_000);
      expect(vence).toBeLessThanOrEqual(despues + horas * 3_600_000);
    });
  });

  describe('votar (confirmar / desmentir)', () => {
    it('responde 404 si la alerta no existe', async () => {
      alertas.findOne.mockResolvedValue(null);
      await expect(
        service.confirmar(7, USUARIO_ID, CERCA),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(votos.save).not.toHaveBeenCalled();
    });

    it('responde 409 si la alerta ya esta resuelta', async () => {
      alertas.findOne.mockResolvedValue(
        alertaActiva({ estado: EstadoAlerta.Resuelta }),
      );
      await expect(
        service.desmentir(7, USUARIO_ID, CERCA),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(votos.save).not.toHaveBeenCalled();
    });

    it('responde 409 si la alerta ya vencio', async () => {
      alertas.findOne.mockResolvedValue(
        alertaActiva({ expiraEn: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.confirmar(7, USUARIO_ID, CERCA),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(votos.save).not.toHaveBeenCalled();
    });

    it('responde 400 si estas lejos y no registra nada', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva());
      await expect(
        service.confirmar(7, USUARIO_ID, LEJOS),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(votos.save).not.toHaveBeenCalled();
      expect(alertas.save).not.toHaveBeenCalled();
    });

    it('el 400 dice a cuantos metros estas', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva());
      await expect(
        service.desmentir(7, USUARIO_ID, JUSTO_FUERA),
      ).rejects.toThrow(/156 m/);
    });

    it('acepta el voto justo dentro del radio de 150 m', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva());
      await expect(
        service.confirmar(7, USUARIO_ID, JUSTO_DENTRO),
      ).resolves.toBeDefined();
    });

    it('responde 409 si ya habias votado esa alerta', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva());
      votos.save.mockRejectedValue(violacionDeUnicidad());
      await expect(
        service.confirmar(7, USUARIO_ID, CERCA),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(alertas.save).not.toHaveBeenCalled();
    });

    it('no esconde otros errores de la base de datos', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva());
      const caida = new Error('conexion perdida');
      votos.save.mockRejectedValue(caida);
      await expect(service.confirmar(7, USUARIO_ID, CERCA)).rejects.toBe(caida);
    });

    it('confirmar guarda el voto y reinicia el contador de dudas', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva({ confirmacionesNo: 2 }));

      const resultado = await service.confirmar(7, USUARIO_ID, CERCA);

      expect(votos.create).toHaveBeenCalledWith({
        alertaId: 7,
        usuarioId: USUARIO_ID,
        tipo: TipoVotoAlerta.Confirmar,
      });
      expect(votos.save).toHaveBeenCalledTimes(1);
      expect(resultado.confirmacionesNo).toBe(0);
      expect(resultado.estado).toBe(EstadoAlerta.Activa);
      expect(resultado.miVoto).toBe(TipoVotoAlerta.Confirmar);
    });

    it('desmentir suma una duda y deja la alerta activa bajo el umbral', async () => {
      alertas.findOne.mockResolvedValue(alertaActiva({ confirmacionesNo: 0 }));

      const resultado = await service.desmentir(7, USUARIO_ID, CERCA);

      expect(votos.create).toHaveBeenCalledWith({
        alertaId: 7,
        usuarioId: USUARIO_ID,
        tipo: TipoVotoAlerta.Desmentir,
      });
      expect(resultado.confirmacionesNo).toBe(1);
      expect(resultado.estado).toBe(EstadoAlerta.Activa);
      expect(resultado.miVoto).toBe(TipoVotoAlerta.Desmentir);
    });

    it('desmentir resuelve la alerta al llegar al umbral', async () => {
      alertas.findOne.mockResolvedValue(
        alertaActiva({ confirmacionesNo: UMBRAL_DESMENTIDOS - 1 }),
      );

      const resultado = await service.desmentir(7, USUARIO_ID, CERCA);

      expect(resultado.confirmacionesNo).toBe(UMBRAL_DESMENTIDOS);
      expect(resultado.estado).toBe(EstadoAlerta.Resuelta);
    });

    describe('vigencia', () => {
      const HORA = 60 * 60 * 1000;
      const enDiezMinutos = () => Date.now() + 10 * 60 * 1000;

      it.each([
        [GravedadAlerta.Baja, 2],
        [GravedadAlerta.Media, 6],
        [GravedadAlerta.Alta, 24],
      ])(
        'confirmar renueva una alerta %s: vence %i h despues de la confirmacion',
        async (gravedad, horas) => {
          alertas.findOne.mockResolvedValue(
            alertaActiva({ gravedad, expiraEn: new Date(enDiezMinutos()) }),
          );
          const antes = Date.now();

          const resultado = await service.confirmar(7, USUARIO_ID, CERCA);

          const despues = Date.now();
          const vence = resultado.expiraEn.getTime();
          expect(vence).toBeGreaterThanOrEqual(antes + horas * HORA);
          expect(vence).toBeLessThanOrEqual(despues + horas * HORA);
        },
      );

      it('desmentir no toca la vigencia', async () => {
        const original = enDiezMinutos();
        alertas.findOne.mockResolvedValue(
          alertaActiva({ expiraEn: new Date(original) }),
        );

        const resultado = await service.desmentir(7, USUARIO_ID, CERCA);

        expect(resultado.expiraEn.getTime()).toBe(original);
      });

      it('un voto rechazado por lejania no renueva la vigencia', async () => {
        const original = enDiezMinutos();
        const alerta = alertaActiva({ expiraEn: new Date(original) });
        alertas.findOne.mockResolvedValue(alerta);

        await expect(
          service.confirmar(7, USUARIO_ID, LEJOS),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(alerta.expiraEn.getTime()).toBe(original);
      });

      it('un voto repetido no renueva la vigencia', async () => {
        const original = enDiezMinutos();
        const alerta = alertaActiva({ expiraEn: new Date(original) });
        alertas.findOne.mockResolvedValue(alerta);
        votos.save.mockRejectedValue(violacionDeUnicidad());

        await expect(
          service.confirmar(7, USUARIO_ID, CERCA),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(alerta.expiraEn.getTime()).toBe(original);
      });
    });
  });

  describe('expirarVencidas', () => {
    const AHORA = new Date('2026-10-05T12:00:00.000Z');
    const filasAfectadas = (affected?: number): UpdateResult => ({
      raw: [],
      generatedMaps: [],
      affected,
    });

    it('pasa a Expirada las Activas cuyo vencimiento ya llego (<= ahora)', async () => {
      alertas.update.mockResolvedValue(filasAfectadas(2));

      await service.expirarVencidas(AHORA);

      expect(alertas.update).toHaveBeenCalledTimes(1);
      expect(alertas.update).toHaveBeenCalledWith(
        { estado: EstadoAlerta.Activa, expiraEn: LessThanOrEqual(AHORA) },
        { estado: EstadoAlerta.Expirada },
      );
    });

    it('devuelve cuantas alertas expiro', async () => {
      alertas.update.mockResolvedValue(filasAfectadas(3));
      await expect(service.expirarVencidas(AHORA)).resolves.toBe(3);
    });

    it('devuelve 0 si no habia nada vencido', async () => {
      alertas.update.mockResolvedValue(filasAfectadas(0));
      await expect(service.expirarVencidas(AHORA)).resolves.toBe(0);
    });

    it('cuenta 0 si el driver no informa las filas afectadas', async () => {
      alertas.update.mockResolvedValue(filasAfectadas(undefined));
      await expect(service.expirarVencidas(AHORA)).resolves.toBe(0);
    });

    it('usa la hora actual cuando no se le pasa una', async () => {
      alertas.update.mockResolvedValue(filasAfectadas(0));
      const antes = Date.now();

      await service.expirarVencidas();

      const criterio = alertas.update.mock.calls[0][0] as {
        expiraEn: { value: Date };
      };
      expect(criterio.expiraEn.value.getTime()).toBeGreaterThanOrEqual(antes);
      expect(criterio.expiraEn.value.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('findActivas', () => {
    it('adjunta a cada alerta el voto de quien consulta (o null)', async () => {
      alertas.find.mockResolvedValue([
        alertaActiva({ id: 7 }),
        alertaActiva({ id: 8 }),
      ]);
      votos.find.mockResolvedValue([
        {
          alertaId: 8,
          usuarioId: USUARIO_ID,
          tipo: TipoVotoAlerta.Desmentir,
        } as AlertaVoto,
      ]);

      const resultado = await service.findActivas(USUARIO_ID);

      expect(resultado.map((a) => [a.id, a.miVoto])).toEqual([
        [7, null],
        [8, TipoVotoAlerta.Desmentir],
      ]);
      expect(votos.find).toHaveBeenCalledWith({
        where: { usuarioId: USUARIO_ID, alertaId: In([7, 8]) },
      });
    });

    it('sin alertas no consulta votos', async () => {
      alertas.find.mockResolvedValue([]);
      await expect(service.findActivas(USUARIO_ID)).resolves.toEqual([]);
      expect(votos.find).not.toHaveBeenCalled();
    });
  });
});
