import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Min,
} from 'class-validator';
import {
  RETIRAR_CALIFICACION,
  ValorCalificacion,
} from '../calificacion.enum';

export class CalificarDto {
  @IsIn([...Object.values(ValorCalificacion), RETIRAR_CALIFICACION], {
    message: 'El valor debe ser arriba, abajo o ninguno',
  })
  valor: ValorCalificacion | typeof RETIRAR_CALIFICACION;

  @IsOptional()
  @IsInt({ message: 'area debe ser un entero' })
  @Min(0)
  area?: number;

  @IsOptional()
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng?: number;
}
