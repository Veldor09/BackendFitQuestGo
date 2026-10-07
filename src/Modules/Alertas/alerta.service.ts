import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { distanciaMetros } from '../../common/distancia.util';
import { esViolacionDeUnicidad } from '../../common/postgres';
import { RADIO_VOTO_METROS } from '../../common/votacion';
import { InsigniasService } from '../Insignias/insignias.service';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CrearAlertaDto, VotarAlertaDto } from './dto/AlertaDTO';
import { AlertaVoto } from './alerta-voto.entity';
import { Alerta } from './alerta.entity';
import {
  EstadoAlerta,
  GravedadAlerta,
  TipoVotoAlerta,
  TTL_HORAS_POR_GRAVEDAD,
  UMBRAL_DESMENTIDOS,
} from './estado-alerta.enum';
import { TipoAlerta } from './tipo-alerta.enum';

/** Una alerta junto con el voto de quien la consulta (null si aun no voto). */
export type AlertaConVoto = Alerta & { miVoto: TipoVotoAlerta | null };

/** Cuando vence una alerta de esta gravedad si su vigencia empieza ahora. */
function vigenciaDesdeAhora(gravedad: GravedadAlerta): Date {
  return new Date(
    Date.now() + TTL_HORAS_POR_GRAVEDAD[gravedad] * 60 * 60 * 1000,
  );
}

@Injectable()
export class AlertaService {
  private readonly logger = new Logger(AlertaService.name);

  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
    @InjectRepository(AlertaVoto)
    private readonly votoRepository: Repository<AlertaVoto>,
    private readonly insigniasService: InsigniasService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Punto encapsulado para notificar al autor cuando su alerta pasa a publicada / activa.
   */
  async notificarAlertaPublicada(alerta: Alerta): Promise<void> {
    if (!alerta.creadoPor?.id) return;
    try {
      await this.notificacionesService.crear({
        idUsuario: alerta.creadoPor.id,
        categoria: CategoriaNotificacion.Alertas,
        titulo: 'Tu alerta fue publicada',
        mensaje: 'Tu reporte ya es visible para la comunidad.',
        referenciaTipo: ReferenciaTipoNotificacion.Alerta,
        referenciaId: alerta.id,
      });
    } catch (error) {
      this.logger.error(
        `Error al notificar alerta publicada ${alerta.id}: ${error.message}`,
      );
    }
  }

  /**
   * Alertas vigentes: para el mapa (HOM-01) y para la supervision del admin
   * (ADM-06) por igual. A diferencia de Nodos, una alerta no pasa por cola de
   * aprobacion: se publica de inmediato (ALR-03) por ser de seguridad. Cada una
   * trae `miVoto`, para que la app no vuelva a preguntarle a quien ya voto.
   *
   * El filtro por `expiraEn` la oculta en el instante en que vence; pasarla a
   * `Expirada` en la base lo hace `AlertaExpiracionTask`, hasta un minuto
   * despues (ver `expirarVencidas`).
   */
  findMisAlertas(usuarioId: number): Promise<Alerta[]> {
    return this.alertaRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { creadoEn: 'DESC' },
    });
  }

  async findActivas(usuarioId: number): Promise<AlertaConVoto[]> {
    const alertas = await this.alertaRepository.find({
      where: { estado: EstadoAlerta.Activa, expiraEn: MoreThan(new Date()) },
      order: { id: 'DESC' },
    });
    if (alertas.length === 0) {
      return [];
    }
    const votos = await this.votoRepository.find({
      where: { usuarioId, alertaId: In(alertas.map((a) => a.id)) },
    });
    const votoPorAlerta = new Map<number, TipoVotoAlerta>(
      votos.map((v) => [v.alertaId, v.tipo] as const),
    );
    return alertas.map((a) =>
      Object.assign(a, { miVoto: votoPorAlerta.get(a.id) ?? null }),
    );
  }

  async findOne(id: number): Promise<Alerta> {
    const alerta = await this.alertaRepository.findOne({ where: { id } });
    if (!alerta) {
      throw new NotFoundException(`Alerta ${id} no encontrada`);
    }
    return alerta;
  }

  async create(dto: CrearAlertaDto, usuarioId: number): Promise<Alerta> {
    const alerta = this.alertaRepository.create({
      ...dto,
      // El texto libre solo tiene sentido con el tipo "otro".
      tipoOtro: dto.tipo === TipoAlerta.Otro ? (dto.tipoOtro ?? null) : null,
      estado: EstadoAlerta.Activa,
      confirmacionesNo: 0,
      creadoPor: { id: usuarioId },
      expiraEn: vigenciaDesdeAhora(dto.gravedad),
    });
    const guardada = await this.alertaRepository.save(alerta);

    // Evaluar insignia PRIMERA_ALERTA
    try {
      await this.insigniasService.evaluar(usuarioId);
    } catch (error) {
      this.logger.error(
        `Error al evaluar insignias tras crear alerta para usuario ${usuarioId}: ${error.message}`,
      );
    }

    return guardada;
  }

  /**
   * ALR-04 "Confirmar": alguien la ve vigente. Se reinicia el contador de dudas
   * y su vigencia vuelve a empezar (mientras la sigan confirmando, no vence).
   */
  confirmar(
    id: number,
    usuarioId: number,
    posicion: VotarAlertaDto,
  ): Promise<AlertaConVoto> {
    return this.votar(id, usuarioId, TipoVotoAlerta.Confirmar, posicion);
  }

  /**
   * ALR-04/05 "Ya no esta": suma una duda; al llegar al umbral se resuelve
   * sola, sin intervencion de un admin.
   */
  desmentir(
    id: number,
    usuarioId: number,
    posicion: VotarAlertaDto,
  ): Promise<AlertaConVoto> {
    return this.votar(id, usuarioId, TipoVotoAlerta.Desmentir, posicion);
  }

  /** ADM-06 "Marcar resuelta": accion manual del admin. */
  async cambiarEstado(id: number, estado: EstadoAlerta): Promise<Alerta> {
    const alerta = await this.findOne(id);
    alerta.estado = estado;
    return this.alertaRepository.save(alerta);
  }

  /** ADM-06 "Eliminar". */
  async eliminar(id: number): Promise<void> {
    const alerta = await this.findOne(id);
    await this.alertaRepository.remove(alerta);
  }

  /**
   * ALR-02 "TTL": pasa a `Expirada` toda alerta `Activa` cuya vigencia ya
   * llego. Una sola sentencia, asi que puede correr en paralelo desde varias
   * instancias sin pisarse. Devuelve cuantas expiro.
   */
  async expirarVencidas(ahora: Date = new Date()): Promise<number> {
    const { affected } = await this.alertaRepository.update(
      { estado: EstadoAlerta.Activa, expiraEn: LessThanOrEqual(ahora) },
      { estado: EstadoAlerta.Expirada },
    );
    return affected ?? 0;
  }

  /**
   * Un voto vale solo si la alerta sigue vigente, si quien vota esta a
   * `RADIO_VOTO_METROS` o menos de ella y si es su primer voto sobre ella.
   */
  private async votar(
    id: number,
    usuarioId: number,
    tipo: TipoVotoAlerta,
    posicion: VotarAlertaDto,
  ): Promise<AlertaConVoto> {
    const alerta = await this.findOne(id);
    if (
      alerta.estado !== EstadoAlerta.Activa ||
      alerta.expiraEn.getTime() <= Date.now()
    ) {
      throw new ConflictException('La alerta ya no esta activa');
    }

    const distancia = distanciaMetros(
      posicion.lat,
      posicion.lng,
      alerta.lat,
      alerta.lng,
    );
    if (distancia > RADIO_VOTO_METROS) {
      throw new BadRequestException(
        `Estas a ${Math.round(distancia)} m de la alerta: acercate a menos de ${RADIO_VOTO_METROS} m para votar`,
      );
    }

    await this.registrarVoto(alerta.id, usuarioId, tipo);

    if (tipo === TipoVotoAlerta.Confirmar) {
      alerta.confirmacionesNo = 0;
      alerta.expiraEn = vigenciaDesdeAhora(alerta.gravedad);
    } else {
      alerta.confirmacionesNo += 1;
      if (alerta.confirmacionesNo >= UMBRAL_DESMENTIDOS) {
        alerta.estado = EstadoAlerta.Resuelta;
      }
    }
    const guardada = await this.alertaRepository.save(alerta);
    return Object.assign(guardada, { miVoto: tipo });
  }

  private async registrarVoto(
    alertaId: number,
    usuarioId: number,
    tipo: TipoVotoAlerta,
  ): Promise<void> {
    try {
      await this.votoRepository.save(
        this.votoRepository.create({ alertaId, usuarioId, tipo }),
      );
    } catch (error) {
      // "Un voto por persona" lo impone la restriccion unica de la tabla, no un
      // chequeo previo: asi tambien se frena el doble toque en "Si".
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya votaste esta alerta');
      }
      throw error;
    }
  }
}
