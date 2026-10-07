/**
 * Actividades de una ruta, de lista cerrada: se elige una o varias, no se
 * escribe (evita "Runing" / "running" / "Correr"). Las claves son estables y
 * las mismas del registro de la app; la app las traduce (es / en / pt-BR).
 * `otro` es la salida para lo que no figure en la lista, sin texto libre.
 */
export enum ActividadRuta {
  Running = 'running',
  Ciclismo = 'ciclismo',
  Mtb = 'mtb',
  Hiking = 'hiking',
  Caminata = 'caminata',
  Otro = 'otro',
}
