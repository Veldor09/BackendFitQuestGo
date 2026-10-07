const RADIO_TIERRA_METROS = 6_371_000;

const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (formula de haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = aRadianes(lat2 - lat1);
  const dLng = aRadianes(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(lat1)) *
      Math.cos(aRadianes(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return RADIO_TIERRA_METROS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
