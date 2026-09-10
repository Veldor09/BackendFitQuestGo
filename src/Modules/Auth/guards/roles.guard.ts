import {CanActivate,ExecutionContext,ForbiddenException,Injectable,} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_ROLES } from '../decorators/roles.decorator';
import { RoleId } from '../../Usuarios/roles.enum';
import { RequestAutenticado } from '../types/request-autenticado';

@Injectable()
export class GuardiaRoles implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RoleId[]>(
      CLAVE_ROLES,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }
    const req = contexto.switchToHttp().getRequest<RequestAutenticado>();
    if (!req.usuario || !rolesRequeridos.includes(req.usuario.rol)) {
      throw new ForbiddenException('No tienes permiso para este recurso');
    }
    return true;
  }
}
