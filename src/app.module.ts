import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { opcionesConexion } from './db-options';
import { AlertaModule } from './Modules/Alertas/alerta.module';
import { AuthModule } from './Modules/Auth/auth.module';
import { ClimaModule } from './Modules/Clima/clima.module';
import { InsigniasModule } from './Modules/Insignias/insignias.module';
import { EventoModule } from './Modules/Eventos/evento.module';
import { NodoModule } from './Modules/Nodos/nodo.module';
import { NotificacionesModule } from './Modules/Notificaciones/notificaciones.module';
import { RutaModule } from './Modules/Rutas/ruta.module';
import { RoleModule } from './Modules/Usuarios/roles.module';
import { UserModule } from './Modules/Usuarios/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        ...opcionesConexion(),
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        migrationsRun: process.env.RUN_MIGRATIONS === 'true',
      }),
    }),
    UserModule,
    RoleModule,
    AuthModule,
    NodoModule,
    RutaModule,
    AlertaModule,
    ClimaModule,
    NotificacionesModule,
    InsigniasModule,
    EventoModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
