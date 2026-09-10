export const MAX_NOMBRE_USUARIO = 20;

/** Letras Unicode agrupadas por espacios simples: "Ana", "Ana Maria". */
export const NOMBRE_PERSONA_REGEX = /^\p{L}+(?: \p{L}+)*$/u;

export const MENSAJE_NOMBRE_INVALIDO =
  'El nombre solo admite letras y espacios (sin numeros ni signos)';
