import { IsEnum } from 'class-validator';
import { AccionResolverReporte } from '../resolucion-reporte.enum';

export class ResolverReporteContenidoDto {
  @IsEnum(AccionResolverReporte, {
    message: 'La accion debe ser desactivar o conservar',
  })
  accion: AccionResolverReporte;
}
