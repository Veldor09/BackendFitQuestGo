import { Module } from '@nestjs/common';
import { SeguridadModule } from '../Auth/seguridad.module';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { RegistroAuditoria } from './registro-auditoria.entity';

@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([RegistroAuditoria])],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
