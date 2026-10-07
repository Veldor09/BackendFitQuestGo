export const MAX_NOMBRE_USUARIO = 20;

/** Letras Unicode agrupadas por espacios simples: "Ana", "Ana Maria". */
export const NOMBRE_PERSONA_REGEX = /^\p{L}+(?: \p{L}+)*$/u;

export const MENSAJE_NOMBRE_INVALIDO =
  'El nombre solo admite letras y espacios (sin numeros ni signos)';

export const MAX_NOMBRE_COMERCIAL = 100;

/** Telefono de contacto: digitos con +, espacios o guiones ("8888-8888", "+506 8888 8888"). */
export const TELEFONO_REGEX = /^\+?\d[\d -]{6,18}\d$/;

export const MENSAJE_TELEFONO_INVALIDO =
  'El telefono debe tener entre 8 y 20 caracteres (digitos, +, espacios y guiones)';
