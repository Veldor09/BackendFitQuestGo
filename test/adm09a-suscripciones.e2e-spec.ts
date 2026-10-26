import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrecioPatrocinio } from '../src/Modules/Patrocinio/precio-patrocinio.entity';
import { Suscripcion, EstadoSuscripcion } from '../src/Modules/Patrocinio/suscripcion.entity';
import { RenovacionSuscripcion } from '../src/Modules/Patrocinio/renovacion-suscripcion.entity';
import { SuscripcionesService } from '../src/Modules/Patrocinio/suscripciones.service';
import { RegistroAuditoria } from '../src/Modules/Auditoria/registro-auditoria.entity';
import { AuditoriaService } from '../src/Modules/Auditoria/auditoria.service';
import { User } from '../src/Modules/Usuarios/user.entity';
import { Role } from '../src/Modules/Usuarios/roles.entity';
import { Auth } from '../src/Modules/Auth/auth.entity';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PlanPatrocinio } from '../src/Modules/Patrocinio/plan-patrocinio.entity';

describe('ADM-09A - Integracion PostgreSQL', () => {
  it('debe utilizar exclusivamente la base de pruebas aislada', () => {
    expect(process.env.DB_DATABASE).toBe('fitquest_adm09a_test');
    expect(process.env.DATABASE_URL).toBeFalsy();
  });

  it('debe consultar los planes reales mediante TypeORM', async () => {
    if (
      process.env.DB_DATABASE !== 'fitquest_adm09a_test' ||
      process.env.DATABASE_URL
    ) {
      throw new Error('Conexion bloqueada: base no autorizada');
    }

    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [PlanPatrocinio],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: false,
    });

    try {
      await dataSource.initialize();

      const verificacion = await dataSource.query(
        'SELECT current_database() AS nombre',
      );

      expect(verificacion[0].nombre).toBe('fitquest_adm09a_test');

      const planes = await dataSource
        .getRepository(PlanPatrocinio)
        .find({ order: { id: 'ASC' } });

      expect(planes).toHaveLength(2);
      expect(planes.every((plan) => plan.activo)).toBe(true);
    } finally {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });
  it('debe consultar planes mediante SuscripcionesService real', async () => {
    if (
      process.env.DB_DATABASE !== 'fitquest_adm09a_test' ||
      process.env.DATABASE_URL
    ) {
      throw new Error('Conexion bloqueada: base no autorizada');
    }

    const entidades = [
      PlanPatrocinio,
      PrecioPatrocinio,
      Suscripcion,
      RenovacionSuscripcion,
      RegistroAuditoria,
      User,
      Role,
      Auth,
    ];

    const modulo = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
          entities: entidades,
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: false,
          migrationsRun: false,
        }),
        TypeOrmModule.forFeature(entidades),
      ],
      providers: [SuscripcionesService, AuditoriaService],
    }).compile();

    try {
      const conexion = modulo.get(DataSource);
      const verificacion = await conexion.query(
        'SELECT current_database() AS nombre',
      );

      expect(verificacion[0].nombre).toBe('fitquest_adm09a_test');

      const servicio = modulo.get(SuscripcionesService);
      const resultado = await servicio.consultarPlanes('CR');

      expect(resultado.moneda).toBe('CRC');
      expect(resultado.planes).toHaveLength(2);
      expect(resultado.planes.every((plan) => Number(plan.importe) > 0)).toBe(true);
    } finally {
      await modulo.close();
    }
  });
  it('debe impedir otra solicitud cuando existe una suscripcion activa real', async () => {
    if (
      process.env.DB_DATABASE !== 'fitquest_adm09a_test' ||
      process.env.DATABASE_URL
    ) {
      throw new Error('Conexion bloqueada: base no autorizada');
    }

    const entidades = [
      PlanPatrocinio,
      PrecioPatrocinio,
      Suscripcion,
      RenovacionSuscripcion,
      RegistroAuditoria,
      User,
      Role,
      Auth,
    ];

    const modulo = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
          entities: entidades,
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: false,
          migrationsRun: false,
        }),
        TypeOrmModule.forFeature(entidades),
      ],
      providers: [SuscripcionesService, AuditoriaService],
    }).compile();

    try {
      const conexion = modulo.get(DataSource);
      const verificacion = await conexion.query(
        'SELECT current_database() AS nombre',
      );

      expect(verificacion[0].nombre).toBe('fitquest_adm09a_test');

      const repositorio = conexion.getRepository(Suscripcion);
      const antes = await repositorio.count({
        where: { usuarioId: 1 },
      });

      const activa = await repositorio.findOne({
        where: { usuarioId: 1, estado: EstadoSuscripcion.Activa },
      });

      expect(activa).not.toBeNull();

      const servicio = modulo.get(SuscripcionesService);

      await expect(
        servicio.solicitarSuscripcion(1, {
          planId: 1,
          pais: 'CR',
        }),
      ).rejects.toMatchObject({
        status: 409,
      });

      const despues = await repositorio.count({
        where: { usuarioId: 1 },
      });

      expect(despues).toBe(antes);
    } finally {
      await modulo.close();
    }
  });
  it('debe crear una solicitud real y revertirla', async () => {
    if (
      process.env.DB_DATABASE !== 'fitquest_adm09a_test' ||
      process.env.DATABASE_URL
    ) {
      throw new Error('Conexion bloqueada: base no autorizada');
    }

    const entidades = [
      PlanPatrocinio,
      PrecioPatrocinio,
      Suscripcion,
      RenovacionSuscripcion,
      RegistroAuditoria,
      User,
      Role,
      Auth,
    ];

    const conexion = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: entidades,
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: false,
    });

    let runner: ReturnType<DataSource['createQueryRunner']> | undefined;

    try {
      await conexion.initialize();

      const base = await conexion.query(
        'SELECT current_database() AS nombre',
      );

      expect(base[0].nombre).toBe('fitquest_adm09a_test');

      const repositorio = conexion.getRepository(Suscripcion);

      const antes = await repositorio.count({
        where: { usuarioId: 2 },
      });

      expect(antes).toBe(0);

      runner = conexion.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();

      const servicio = new SuscripcionesService(
        runner.manager.getRepository(PlanPatrocinio),
        runner.manager.getRepository(PrecioPatrocinio),
        runner.manager.getRepository(Suscripcion),
        runner.manager.getRepository(RenovacionSuscripcion),
        {} as AuditoriaService,
        conexion,
      );

      const resultado = await servicio.solicitarSuscripcion(2, {
        planId: 1,
        pais: 'CR',
      });

      expect(resultado).toMatchObject({
        usuarioId: 2,
        planId: 1,
        estado: EstadoSuscripcion.Solicitada,
        pais: 'CR',
        moneda: 'CRC',
      });

      const guardada = await runner.manager
        .getRepository(Suscripcion)
        .findOneBy({ id: resultado.id });

      expect(guardada).not.toBeNull();
      expect(guardada?.precioAplicado).toBeNull();
      expect(guardada?.iniciaEn).toBeNull();
      expect(guardada?.venceEn).toBeNull();
      expect(guardada?.administradorId).toBeNull();
    } finally {
      try {
        if (runner?.isTransactionActive) {
          await runner.rollbackTransaction();
        }
      } finally {
        if (runner && !runner.isReleased) {
          await runner.release();
        }

        if (conexion.isInitialized) {
          await conexion.destroy();
        }
      }
    }

    const verificacion = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [Suscripcion, User, Role, Auth, PlanPatrocinio],
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: false,
    });

    try {
      await verificacion.initialize();

      const base = await verificacion.query(
        'SELECT current_database() AS nombre',
      );

      expect(base[0].nombre).toBe('fitquest_adm09a_test');

      const despues = await verificacion
        .getRepository(Suscripcion)
        .count({ where: { usuarioId: 2 } });

      expect(despues).toBe(0);
    } finally {
      if (verificacion.isInitialized) {
        await verificacion.destroy();
      }
    }
  });
  it('debe aprobar una solicitud real y revertirla', async () => {
    if (
      process.env.DB_DATABASE !== 'fitquest_adm09a_test' ||
      process.env.DATABASE_URL
    ) {
      throw new Error('Conexion bloqueada: base no autorizada');
    }

    const entidades = [
      PlanPatrocinio,
      PrecioPatrocinio,
      Suscripcion,
      RenovacionSuscripcion,
      RegistroAuditoria,
      User,
      Role,
      Auth,
    ];

    const conexion = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: entidades,
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: false,
    });

    let runner: ReturnType<DataSource['createQueryRunner']> | undefined;

    try {
      await conexion.initialize();

      const base = await conexion.query(
        'SELECT current_database() AS nombre',
      );

      expect(base[0].nombre).toBe('fitquest_adm09a_test');

      const suscripciones = conexion.getRepository(Suscripcion);

      expect(
        await suscripciones.count({ where: { usuarioId: 2 } }),
      ).toBe(0);

      runner = conexion.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();

      const manager = runner.manager;

      const auditoria = new AuditoriaService(
        manager.getRepository(RegistroAuditoria),
      );

      const dataSourceTransaccional = {
        transaction: async <T>(
          operacion: (entityManager: typeof manager) => Promise<T>,
        ): Promise<T> => operacion(manager),
      } as DataSource;

      const servicio = new SuscripcionesService(
        manager.getRepository(PlanPatrocinio),
        manager.getRepository(PrecioPatrocinio),
        manager.getRepository(Suscripcion),
        manager.getRepository(RenovacionSuscripcion),
        auditoria,
        dataSourceTransaccional,
      );

      const solicitud = await servicio.solicitarSuscripcion(2, {
        planId: 1,
        pais: 'CR',
      });

      expect(solicitud.estado).toBe(EstadoSuscripcion.Solicitada);

      const resultado = await servicio.aprobarSuscripcion(
        solicitud.id,
        3,
      );

      expect(resultado.estado).toBe(EstadoSuscripcion.Activa);
      expect(resultado.administradorId).toBe(3);
      expect(Number(resultado.precioAplicado)).toBeGreaterThan(0);
      expect(resultado.iniciaEn).toBeInstanceOf(Date);
      expect(resultado.venceEn).toBeInstanceOf(Date);

      const plan = await manager
        .getRepository(PlanPatrocinio)
        .findOneByOrFail({ id: 1 });

      const dias =
        (resultado.venceEn!.getTime() -
          resultado.iniciaEn!.getTime()) /
        (24 * 60 * 60 * 1000);

      expect(dias).toBe(plan.duracionDias);

      const guardada = await manager
        .getRepository(Suscripcion)
        .findOneByOrFail({ id: solicitud.id });

      expect(guardada.estado).toBe(EstadoSuscripcion.Activa);
      expect(guardada.administradorId).toBe(3);

      const registros = await manager
        .getRepository(RegistroAuditoria)
        .find({
          where: {
            accion: 'APROBAR_SUSCRIPCION',
            entidad: 'suscripciones',
            entidadId: solicitud.id,
          },
        });

      expect(registros).toHaveLength(1);
      expect(registros[0].administradorId).toBe(3);
      expect(registros[0].detalle).toMatchObject({
        usuarioId: 2,
        planId: 1,
        moneda: 'CRC',
      });
    } finally {
      try {
        if (runner?.isTransactionActive) {
          await runner.rollbackTransaction();
        }
      } finally {
        if (runner && !runner.isReleased) {
          await runner.release();
        }

        if (conexion.isInitialized) {
          await conexion.destroy();
        }
      }
    }

    const verificacion = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: entidades,
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false,
      migrationsRun: false,
    });

    try {
      await verificacion.initialize();

      const base = await verificacion.query(
        'SELECT current_database() AS nombre',
      );

      expect(base[0].nombre).toBe('fitquest_adm09a_test');

      const despues = await verificacion
        .getRepository(Suscripcion)
        .count({ where: { usuarioId: 2 } });

      expect(despues).toBe(0);
    } finally {
      if (verificacion.isInitialized) {
        await verificacion.destroy();
      }
    }
  });
});
