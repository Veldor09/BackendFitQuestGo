import { SetMetadata } from '@nestjs/common';
import { RoleId } from '../../Usuarios/roles.enum';

export const CLAVE_ROLES = 'roles';

export const Roles = (...roles: RoleId[]) => SetMetadata(CLAVE_ROLES, roles);
