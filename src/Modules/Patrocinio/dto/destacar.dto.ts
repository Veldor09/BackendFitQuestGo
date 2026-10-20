import { IsBoolean } from 'class-validator';

/** Cuerpo de `PATCH /nodos/:id/destacar` y `PATCH /eventos/:id/destacar`. */
export class DestacarDto {
  @IsBoolean({ message: 'destacar debe ser verdadero o falso' })
  destacar: boolean;
}
