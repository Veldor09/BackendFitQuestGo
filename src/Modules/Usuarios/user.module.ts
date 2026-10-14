
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from './roles.module';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';

import { Ruta } from '../Rutas/ruta.entity';
import { RutaFavorita } from '../Rutas/ruta-favorita.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { NodoVoto } from '../Nodos/nodo-voto.entity';
import { Alerta } from '../Alertas/alerta.entity';
import { AlertaVoto } from '../Alertas/alerta-voto.entity';

import { UserController } from './user.controller';
import { User } from './user.entity';
import { UsuarioFoto } from './usuario-foto.entity';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UsuarioFoto,
      Ruta,
      RutaFavorita,
      Nodo,
      NodoVoto,
      Alerta,
      AlertaVoto,
    ]),
    RoleModule,
    SeguridadModule,
    InsigniasModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
