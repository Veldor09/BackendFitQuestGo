import { Request } from 'express';
import { UsuarioAutenticado } from './carga-jwt';

export interface RequestAutenticado extends Request {
  usuario: UsuarioAutenticado;
}
