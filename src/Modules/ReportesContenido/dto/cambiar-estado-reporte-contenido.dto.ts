import { IsEnum } from 'class-validator';
import { EstadoReporteContenido } from '../estado-reporte-contenido.enum';

export class CambiarEstadoReporteContenidoDto {
  @IsEnum(EstadoReporteContenido)
  estado: EstadoReporteContenido;
}
