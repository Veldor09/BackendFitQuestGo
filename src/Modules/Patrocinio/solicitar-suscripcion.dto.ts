
import {
  IsInt,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

export class SolicitarSuscripcionDto {
  @IsInt({
    message: 'El identificador del plan debe ser un numero entero',
  })
  @IsPositive({
    message: 'El identificador del plan debe ser positivo',
  })
  planId: number;

  @IsString({
    message: 'El pais debe ser un texto',
  })
  @Matches(/^[A-Z]{2}$/, {
    message: 'El pais debe contener dos letras mayusculas, por ejemplo CR',
  })
  pais: string;
}
