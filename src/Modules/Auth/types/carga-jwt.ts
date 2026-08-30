export interface CargaJwt {
  sub: number;
  email: string;
  rol: number;
}

export interface UsuarioAutenticado {
  id: number;
  email: string;
  rol: number;
}
