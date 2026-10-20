import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { CodigoMoneda, MONEDAS, monedaParaPais } from './monedas';

export interface RespuestaMoneda {
  pais: string | null;
  moneda: CodigoMoneda;
  simbolo: string;
  decimales: number;
}

@Controller('patrocinio')
@UseGuards(GuardiaJwt)
export class PatrocinioController {
  /**
   * Moneda en la que se cobraria a alguien de `pais` (codigo ISO de dos
   * letras). Provisional: cuando ADM-09A devuelva la moneda dentro de sus
   * planes, la pantalla de planes dejara de necesitarlo.
   */
  @Get('moneda')
  moneda(@Query('pais') pais?: string): RespuestaMoneda {
    const codigo = monedaParaPais(pais);
    const moneda = MONEDAS.find((m) => m.codigo === codigo)!;
    const normalizado = pais?.trim().toUpperCase();
    return {
      pais: normalizado ? normalizado : null,
      moneda: moneda.codigo,
      simbolo: moneda.simbolo,
      decimales: moneda.decimales,
    };
  }
}
