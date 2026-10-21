import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import {
  SUSCRIPCIONES_VIGENTES,
  type SuscripcionesVigentes,
  type SuscripcionPorVencer,
} from './suscripciones-vigentes';

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_POR_VENCER = 3;
/** Si el servidor estuvo dormido varios dias, "vencio" todavia se avisa. */
const DIAS_VENCIDA = 7;

/**
 * Recordatorios diarios del plan: "vence pronto" (3 dias antes) y "vencio".
 * Corre a las 9:00 de Costa Rica y al arrancar (el servidor puede estar
 * dormido a esa hora); los avisos no se duplican y no se manda ninguno a quien
 * ya renovo.
 */
@Injectable()
export class SuscripcionAvisosTask implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuscripcionAvisosTask.name);

  constructor(
    @Inject(SUSCRIPCIONES_VIGENTES)
    private readonly vigentes: SuscripcionesVigentes,
    private readonly avisos: PatrocinioAvisosService,
  ) {}

  onApplicationBootstrap(): Promise<unknown> {
    return this.avisarVencimientos();
  }

  @Cron('0 9 * * *', {
    name: 'avisos-suscripciones',
    timeZone: 'America/Costa_Rica',
    waitForCompletion: true,
  })
  async avisarVencimientos(
    ahora: Date = new Date(),
  ): Promise<{ porVencer: number; vencidas: number }> {
    try {
      const hasta = new Date(ahora.getTime() + DIAS_POR_VENCER * DIA_MS);
      const porVencer = await this.sinRenovar(
        await this.vigentes.vencenEntre(ahora, hasta),
        hasta,
      );
      const vencidas = await this.sinRenovar(
        await this.vigentes.vencenEntre(
          new Date(ahora.getTime() - DIAS_VENCIDA * DIA_MS),
          ahora,
        ),
        ahora,
      );

      let avisosPorVencer = 0;
      for (const s of porVencer) {
        if (
          await this.avisos.planPorVencer(
            s.usuarioId,
            s.suscripcionId,
            s.venceEn,
          )
        ) {
          avisosPorVencer++;
        }
      }
      let avisosVencidas = 0;
      for (const s of vencidas) {
        if (await this.avisos.planVencido(s.usuarioId, s.suscripcionId)) {
          avisosVencidas++;
        }
      }
      return { porVencer: avisosPorVencer, vencidas: avisosVencidas };
    } catch (error) {
      // Un fallo pasajero de la base no debe tumbar el servidor: manana reintenta.
      this.logger.error(
        'No se pudieron enviar los avisos de vencimiento',
        error instanceof Error ? error.stack : String(error),
      );
      return { porVencer: 0, vencidas: 0 };
    }
  }

  /** Quita a quien tiene una suscripcion vigente en `instante`: ya renovo. */
  private async sinRenovar(
    candidatas: SuscripcionPorVencer[],
    instante: Date,
  ): Promise<SuscripcionPorVencer[]> {
    if (candidatas.length === 0) return [];
    const duenos = [...new Set(candidatas.map((s) => s.usuarioId))];
    const renovaron = await this.vigentes.conVigencia(duenos, instante);
    return candidatas.filter((s) => !renovaron.has(s.usuarioId));
  }
}
