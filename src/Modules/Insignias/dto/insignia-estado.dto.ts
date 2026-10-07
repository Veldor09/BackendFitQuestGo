export interface InsigniaEstadoDto {
  codigo: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  desbloqueada: boolean;
  fechaObtenida: string | null;
  progreso: number | null;
  meta: number | null;
}
