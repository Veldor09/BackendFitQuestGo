import {
  IsArray,
  IsDateString,
  IsNumber,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PuntoRutaDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CrearRecorridoDto {
  @IsNumber()
  @IsPositive()
  distanciaKm: number;

  @IsNumber()
  @IsPositive()
  duracionSegundos: number;

  @IsDateString()
  iniciadoEn: string;

  @IsDateString()
  finalizadoEn: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoRutaDto)
  puntos: PuntoRutaDto[];
}
