import { Controller, Get, UseGuards } from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { RoleId } from '../Usuarios/roles.enum';

import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  obtenerResumen() {
    return this.dashboardService.obtenerResumen();
  }
}