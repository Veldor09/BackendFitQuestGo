import {
  AlertaClima,
  HoraPronostico,
  NivelAlertaClima,
  TipoAlertaClima,
} from './clima.tipos';

/** Lluvia fuerte segun la clasificacion de la AMS: 7.6 mm/h o mas. */
export const UMBRAL_LLUVIA_PRECAUCION_MM_H = 7.6;
/** Aguacero torrencial: riesgo de crecidas repentinas en rios y quebradas. */
export const UMBRAL_LLUVIA_PELIGRO_MM_H = 25;
/** Sensacion termica a partir de la cual entrenar al sol exige cuidado... */
export const UMBRAL_CALOR_PRECAUCION_C = 35;
/** ...y a partir de la cual es peligroso (golpe de calor). */
export const UMBRAL_CALOR_PELIGRO_C = 40;

/** Codigos de la OMM: 65 lluvia intensa, 67 lluvia helada intensa, 82 chubascos violentos. */
const CODIGOS_LLUVIA_INTENSA = new Set([65, 67, 82]);
/** 95 tormenta; 96 y 99, con granizo. */
const CODIGOS_TORMENTA = new Set([95, 96, 99]);

const RANGO_NIVEL: Record<NivelAlertaClima, number> = {
  [NivelAlertaClima.Precaucion]: 1,
  [NivelAlertaClima.Peligro]: 2,
};

const aUnDecimal = (valor: number): number => Math.round(valor * 10) / 10;

function nivelDeLluvia(hora: HoraPronostico): NivelAlertaClima | null {
  const mm = hora.precipitacionMmH;
  if (mm !== null && mm >= UMBRAL_LLUVIA_PELIGRO_MM_H) {
    return NivelAlertaClima.Peligro;
  }
  const intensa =
    hora.codigoWmo !== null && CODIGOS_LLUVIA_INTENSA.has(hora.codigoWmo);
  if ((mm !== null && mm >= UMBRAL_LLUVIA_PRECAUCION_MM_H) || intensa) {
    return NivelAlertaClima.Precaucion;
  }
  return null;
}

function nivelDeCalor(hora: HoraPronostico): NivelAlertaClima | null {
  const grados = hora.sensacionC;
  if (grados === null) return null;
  if (grados >= UMBRAL_CALOR_PELIGRO_C) return NivelAlertaClima.Peligro;
  if (grados >= UMBRAL_CALOR_PRECAUCION_C) return NivelAlertaClima.Precaucion;
  return null;
}

/** Las alertas que una hora del pronostico dispara (a lo sumo una por tipo). */
function alertasDeLaHora(hora: HoraPronostico, enHoras: number): AlertaClima[] {
  const alertas: AlertaClima[] = [];

  const lluvia = nivelDeLluvia(hora);
  if (lluvia) {
    alertas.push({
      tipo: TipoAlertaClima.Lluvia,
      nivel: lluvia,
      enHoras,
      valor:
        hora.precipitacionMmH === null
          ? null
          : aUnDecimal(hora.precipitacionMmH),
    });
  }
  if (hora.codigoWmo !== null && CODIGOS_TORMENTA.has(hora.codigoWmo)) {
    alertas.push({
      tipo: TipoAlertaClima.Tormenta,
      nivel: NivelAlertaClima.Peligro,
      enHoras,
      valor: null,
    });
  }
  const calor = nivelDeCalor(hora);
  if (calor && hora.sensacionC !== null) {
    alertas.push({
      tipo: TipoAlertaClima.Calor,
      nivel: calor,
      enHoras,
      valor: aUnDecimal(hora.sensacionC),
    });
  }
  return alertas;
}

/** `a` es peor que `b`: mas grave; a igual gravedad, valor mas alto; luego, mas cercano. */
function esPeor(a: AlertaClima, b: AlertaClima): boolean {
  if (RANGO_NIVEL[a.nivel] !== RANGO_NIVEL[b.nivel]) {
    return RANGO_NIVEL[a.nivel] > RANGO_NIVEL[b.nivel];
  }
  const valorA = a.valor ?? Number.NEGATIVE_INFINITY;
  const valorB = b.valor ?? Number.NEGATIVE_INFINITY;
  if (valorA !== valorB) return valorA > valorB;
  return a.enHoras < b.enHoras;
}

/**
 * Avisos del clima para un pronostico por horas (la primera es "ahora"): de
 * cada tipo, solo el peor momento. Primero lo mas grave y, a igual gravedad, lo
 * mas cercano en el tiempo.
 */
export function clasificarPronostico(horas: HoraPronostico[]): AlertaClima[] {
  const peorPorTipo = new Map<TipoAlertaClima, AlertaClima>();
  horas.forEach((hora, enHoras) => {
    for (const alerta of alertasDeLaHora(hora, enHoras)) {
      const actual = peorPorTipo.get(alerta.tipo);
      if (!actual || esPeor(alerta, actual)) {
        peorPorTipo.set(alerta.tipo, alerta);
      }
    }
  });
  return [...peorPorTipo.values()].sort(
    (a, b) =>
      RANGO_NIVEL[b.nivel] - RANGO_NIVEL[a.nivel] || a.enHoras - b.enHoras,
  );
}
