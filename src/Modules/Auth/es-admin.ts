import { RoleId } from '../Usuarios/roles.enum';
import type { UsuarioAutenticado } from './types/carga-jwt';

// El rol viaja en el JWT como numero; se compara contra el id del enum.
export const esAdmin = (usuario: UsuarioAutenticado): boolean =>
  usuario.rol === Number(RoleId.Admin);
