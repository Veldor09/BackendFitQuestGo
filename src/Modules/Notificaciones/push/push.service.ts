import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../Usuarios/user.entity';
import { RegistrarDispositivoDto } from './dispositivo-push.dto';
import { DispositivoPush } from './dispositivo-push.entity';
import { idiomaPushValido, SolicitudPush, textoPush } from './push-plantillas';
import { PROVEEDOR_PUSH, type ProveedorPush } from './proveedor-push';

/** La notificacion ya guardada de la que sale el aviso. */
export interface NotificacionParaPush {
  id: number;
  idUsuario: number;
  categoria: string;
  referenciaTipo: string | null;
  referenciaId: number | null;
}

const HORA_MS = 60 * 60 * 1000;

/**
 * Avisos fuera de la app. Cuida tres cosas para no ser pesado:
 * 1. solo sale lo que el codigo marca a proposito con una [SolicitudPush]
 *    (ver `TipoPush`): nunca "todo lo que cae en la campana";
 * 2. respeta el interruptor "Notificaciones push" del usuario (`notificaciones`);
 * 3. como mucho [MAXIMO_POR_HORA] por persona por hora; lo demas queda en la
 *    campana de la app, sin sonar.
 */
@Injectable()
export class PushService {
  static readonly MAXIMO_POR_HORA = 5;

  private readonly logger = new Logger(PushService.name);
  private readonly envios = new Map<number, number[]>();

  constructor(
    @InjectRepository(DispositivoPush)
    private readonly dispositivos: Repository<DispositivoPush>,
    @InjectRepository(User)
    private readonly usuarios: Repository<User>,
    @Inject(PROVEEDOR_PUSH)
    private readonly proveedor: ProveedorPush,
  ) {}

  /** Aparte para poder fijar la hora en las pruebas. */
  protected ahora(): number {
    return Date.now();
  }

  /** Guarda (o actualiza) el telefono. Un token es de una sola persona a la vez. */
  async registrar(
    usuarioId: number,
    dto: RegistrarDispositivoDto,
  ): Promise<{ registrado: true }> {
    const idioma = idiomaPushValido(dto.idioma);
    const existente = await this.dispositivos.findOne({
      where: { token: dto.token },
    });
    if (existente) {
      existente.usuarioId = usuarioId;
      existente.plataforma = dto.plataforma;
      existente.idioma = idioma;
      await this.dispositivos.save(existente);
    } else {
      await this.dispositivos.save(
        this.dispositivos.create({
          usuarioId,
          token: dto.token,
          plataforma: dto.plataforma,
          idioma,
        }),
      );
    }
    return { registrado: true };
  }

  /** Cierre de sesion o interruptor apagado: ese telefono deja de recibir. */
  async quitar(usuarioId: number, token: string): Promise<{ eliminado: true }> {
    await this.dispositivos.delete({ usuarioId, token });
    return { eliminado: true };
  }

  /**
   * Manda el aviso a los telefonos del usuario. Nunca lanza: un fallo de aqui
   * no puede romper la accion que lo origino (aprobar una ruta, etc.).
   */
  async notificar(
    notificacion: NotificacionParaPush,
    solicitud: SolicitudPush,
  ): Promise<void> {
    try {
      const usuario = await this.usuarios.findOne({
        where: { id: notificacion.idUsuario },
        select: { id: true, notificaciones: true },
        loadEagerRelations: false,
      });
      if (!usuario?.notificaciones) return;

      if (!this.hayCupo(usuario.id)) {
        this.logger.debug(
          `Usuario ${usuario.id} ya recibio ${PushService.MAXIMO_POR_HORA} avisos esta hora: se queda en la campana`,
        );
        return;
      }

      const telefonos = await this.dispositivos.find({
        where: { usuarioId: usuario.id },
      });
      let salio = false;
      for (const telefono of telefonos) {
        const { titulo, cuerpo } = textoPush(solicitud, telefono.idioma);
        const resultado = await this.proveedor.enviar({
          token: telefono.token,
          titulo,
          cuerpo,
          datos: this.datos(notificacion, solicitud),
          colapsarClave: `${solicitud.tipo}:${notificacion.referenciaId ?? notificacion.id}`,
        });
        if (resultado === 'token_invalido') {
          await this.dispositivos.delete({ id: telefono.id });
        } else if (resultado === 'enviado') {
          salio = true;
        }
      }
      if (salio) this.anotar(usuario.id);
    } catch (error) {
      this.logger.warn(
        `No se pudo mandar el aviso de la notificacion ${notificacion.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private datos(
    n: NotificacionParaPush,
    s: SolicitudPush,
  ): Record<string, string> {
    return {
      tipo: s.tipo,
      categoria: n.categoria,
      notificacionId: String(n.id),
      ...(n.referenciaTipo ? { referenciaTipo: n.referenciaTipo } : {}),
      ...(n.referenciaId != null
        ? { referenciaId: String(n.referenciaId) }
        : {}),
    };
  }

  private recientes(usuarioId: number): number[] {
    const desde = this.ahora() - HORA_MS;
    const vigentes = (this.envios.get(usuarioId) ?? []).filter(
      (t) => t > desde,
    );
    this.envios.set(usuarioId, vigentes);
    return vigentes;
  }

  private hayCupo(usuarioId: number): boolean {
    return this.recientes(usuarioId).length < PushService.MAXIMO_POR_HORA;
  }

  private anotar(usuarioId: number): void {
    this.recientes(usuarioId).push(this.ahora());
  }
}
