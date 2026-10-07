import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertaService } from './alerta.service';

/**
 * ALR-02 "TTL": una alerta que cumple su vigencia no solo se oculta al
 * consultarla (`findActivas` ya filtra por `expiraEn`), ademas cambia de estado
 * a `Expirada`. Corre cada minuto y una vez al arrancar, para poner al dia lo
 * que vencio mientras el servidor estaba apagado.
 */
@Injectable()
export class AlertaExpiracionTask implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertaExpiracionTask.name);

  constructor(private readonly alertaService: AlertaService) {}

  onApplicationBootstrap(): Promise<void> {
    return this.expirarVencidas();
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'expirar-alertas',
    waitForCompletion: true,
  })
  async expirarVencidas(): Promise<void> {
    try {
      const expiradas = await this.alertaService.expirarVencidas();
      if (expiradas > 0) {
        this.logger.log(`${expiradas} alerta(s) vencida(s) pasaron a Expirada`);
      }
    } catch (error) {
      // Un fallo pasajero de la base no debe tumbar el servidor ni dejar la
      // tarea sin correr: el minuto siguiente reintenta.
      this.logger.error(
        'No se pudieron expirar las alertas vencidas',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
