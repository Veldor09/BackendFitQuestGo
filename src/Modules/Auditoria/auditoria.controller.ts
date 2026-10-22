import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';

import { AuditoriaService } from './auditoria.service';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';

@Controller('admin/auditoria')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class AuditoriaController {
  constructor(
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  consultar(@Query() filtros: ConsultarAuditoriaDto) {
    return this.auditoriaService.consultar(filtros);
  }
}
