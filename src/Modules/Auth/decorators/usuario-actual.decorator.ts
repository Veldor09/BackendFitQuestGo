import {createParamDecorator,ExecutionContext,} from '@nestjs/common';
import { RequestAutenticado } from '../types/request-autenticado';
import { UsuarioAutenticado } from '../types/carga-jwt';

export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const req = contexto.switchToHttp().getRequest<RequestAutenticado>();
    return req.usuario;
  },
);
