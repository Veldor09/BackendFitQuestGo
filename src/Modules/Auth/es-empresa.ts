import { RoleId } from '../Usuarios/roles.enum';
import type { UsuarioAutenticado } from './types/carga-jwt';

// El rol viaja en el JWT como numero; se compara contra el id del enum.
export const esEmpresa = (usuario: Pick<UsuarioAutenticado, 'rol'>): boolean =>
  usuario.rol === Number(RoleId.Empresa);

/** `true` si quien creo el contenido tiene una cuenta Empresa. */
export const creadorEsEmpresa = (
  creador?: { idrol?: number } | null,
): boolean => creador?.idrol === Number(RoleId.Empresa);

/**
 * Regla de visibilidad entre empresas y deportistas: una empresa solo ve lo
 * que crearon empresas (la suya y las de otras), nunca lo que crearon los
 * deportistas. Un deportista, un admin y cualquier otro rol ven todo (sujeto a
 * las reglas propias de cada recurso: estado, dueño, etc.).
 *
 * Lo usan nodos y rutas; los eventos solo los crean empresas, asi que no
 * necesitan filtro.
 */
export const puedeVerContenidoDe = (
  actual: Pick<UsuarioAutenticado, 'rol'>,
  creador?: { idrol?: number } | null,
): boolean => !esEmpresa(actual) || creadorEsEmpresa(creador);
