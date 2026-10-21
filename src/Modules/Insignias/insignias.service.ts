
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import {
  CrearInsigniaDto,
  EditarInsigniaDto,
} from './dto/administrar-insignia.dto';
import { InsigniaEstadoDto } from './dto/insignia-estado.dto';
import { CodigoInsignia, TipoInsignia } from './insignia.enum';
import { Insignia, MetricaInsignia } from './insignia.entity';
import { UsuarioInsignia } from './usuario-insignia.entity';

interface MetricasUsuario {
  totalKm: number;
  totalRutas: number;
  totalAlertas: number;
  totalNodos: number;
}

@Injectable()
export class InsigniasService {
  private readonly logger = new Logger(InsigniasService.name);

  constructor(
    @InjectRepository(Insignia)
    private readonly insigniaRepo: Repository<Insignia>,

    @InjectRepository(UsuarioInsignia)
    private readonly usuarioInsigniaRepo: Repository<UsuarioInsignia>,

    private readonly notificacionesService: NotificacionesService,
  ) {}

  // ============================================================
  // ADMINISTRACIÓN DE INSIGNIAS — ADM-10
  // ============================================================

  /**
   * Lista todas las insignias, incluidas las inactivas.
   * Solo debe exponerse mediante endpoints de administrador.
   */
  async listarAdministracion(): Promise<Insignia[]> {
    return this.insigniaRepo.find({
      order: { id: 'ASC' },
    });
  }

  /**
   * Obtiene una insignia por identificador.
   */
  async obtenerAdministracion(id: number): Promise<Insignia> {
    this.validarIdentificador(id);

    const insignia = await this.insigniaRepo.findOne({
      where: { id },
    });

    if (!insignia) {
      throw new NotFoundException('La insignia solicitada no existe');
    }

    return insignia;
  }

  /**
   * Crea una insignia con código único.
   */
  async crearAdministracion(
    dto: CrearInsigniaDto,
  ): Promise<Insignia> {
    const codigo = dto.codigo.trim().toUpperCase();

    const existente = await this.insigniaRepo.findOne({
      where: { codigo },
    });

    if (existente) {
      throw new ConflictException(
        'Ya existe una insignia con ese código',
      );
    }

    this.validarConfiguracion(dto.tipo, dto.metrica, dto.meta);

    const insignia = this.insigniaRepo.create({
      codigo,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion.trim(),
      emoji: dto.emoji.trim(),
      tipo: dto.tipo,
      metrica: dto.metrica,
      meta: dto.meta,
      activa: dto.activa ?? true,
    });

    try {
      return await this.insigniaRepo.save(insignia);
    } catch (error: unknown) {
      if (this.esErrorCodigoDuplicado(error)) {
        throw new ConflictException(
          'Ya existe una insignia con ese código',
        );
      }

      throw error;
    }
  }

  /**
   * Actualiza los campos editables de una insignia.
   *
   * El código permanece inmutable.
   * La desactivación no elimina los logros ya obtenidos.
   */
  async editarAdministracion(
    id: number,
    dto: EditarInsigniaDto,
  ): Promise<Insignia> {
    const insignia = await this.obtenerAdministracion(id);

    const tipo = dto.tipo ?? insignia.tipo;
    const metrica = dto.metrica ?? insignia.metrica;
    const meta = dto.meta ?? insignia.meta;

    this.validarConfiguracion(tipo, metrica, meta);

    if (dto.nombre !== undefined) {
      insignia.nombre = dto.nombre.trim();
    }

    if (dto.descripcion !== undefined) {
      insignia.descripcion = dto.descripcion.trim();
    }

    if (dto.emoji !== undefined) {
      insignia.emoji = dto.emoji.trim();
    }

    if (dto.tipo !== undefined) {
      insignia.tipo = dto.tipo;
    }

    if (dto.metrica !== undefined) {
      insignia.metrica = dto.metrica;
    }

    if (dto.meta !== undefined) {
      insignia.meta = dto.meta;
    }

    if (dto.activa !== undefined) {
      insignia.activa = dto.activa;
    }

    return this.insigniaRepo.save(insignia);
  }

  private validarIdentificador(id: number): void {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El identificador de la insignia no es válido',
      );
    }
  }

  /**
   * Valida la configuración utilizada para evaluar insignias.
   */
  private validarConfiguracion(
    tipo: TipoInsignia,
    metrica: MetricaInsignia | null,
    meta: number | string | null,
  ): void {
    if (!Object.values(TipoInsignia).includes(tipo)) {
      throw new BadRequestException(
        'El tipo de insignia no es válido',
      );
    }

    if (
      metrica === null ||
      !Object.values(MetricaInsignia).includes(metrica)
    ) {
      throw new BadRequestException(
        'La métrica de insignia no es válida',
      );
    }

    if (
      tipo === TipoInsignia.Km &&
      metrica !== MetricaInsignia.Km
    ) {
      throw new BadRequestException(
        'Las insignias de tipo km deben utilizar la métrica km',
      );
    }

    // Las insignias especiales pueden no tener una meta numérica.
    if (meta === null && metrica === MetricaInsignia.Especial) {
      return;
    }

    const valor = meta === null ? NaN : Number(meta);
    const centesimos = Math.round(valor * 100);

    if (
      !Number.isFinite(valor) ||
      valor < 0.01 ||
      valor > 99999999.99 ||
      Math.abs(valor * 100 - centesimos) > 0.000001
    ) {
      throw new BadRequestException(
        'La meta debe ser un número positivo de hasta dos decimales',
      );
    }

  }
  private esErrorCodigoDuplicado(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('code' in error && error.code === '23505') {
      return true;
    }

    if (
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError
    ) {
      return error.driverError.code === '23505';
    }

    return false;
  }

  // ============================================================
  // PROGRESO Y DESBLOQUEO DE INSIGNIAS
  // ============================================================

  /**
   * Determina la métrica de una insignia.
   *
   * Incluye compatibilidad con las insignias originales
   * que todavía no tengan una métrica asignada.
   */
  private obtenerMetrica(
    insignia: Insignia,
  ): MetricaInsignia | null {
    if (insignia.metrica) {
      return insignia.metrica;
    }

    if (insignia.tipo === TipoInsignia.Km) {
      return MetricaInsignia.Km;
    }

    switch (insignia.codigo) {
      case CodigoInsignia.PrimeraRuta:
        return MetricaInsignia.Rutas;

      case CodigoInsignia.PrimeraAlerta:
        return MetricaInsignia.Alertas;

      case CodigoInsignia.PrimerPuntoInteres:
        return MetricaInsignia.Nodos;

      default:
        return null;
    }
  }

  /**
   * Obtiene el valor acumulado correspondiente
   * a la métrica de una insignia.
   *
   * Las métricas especiales no se evalúan hasta
   * que exista una regla específica implementada.
   */
  private obtenerValorMetrica(
    insignia: Insignia,
    metricas: MetricasUsuario,
  ): number | null {
    const metrica = this.obtenerMetrica(insignia);

    switch (metrica) {
      case MetricaInsignia.Km:
        return metricas.totalKm;

      case MetricaInsignia.Rutas:
        return metricas.totalRutas;

      case MetricaInsignia.Alertas:
        return metricas.totalAlertas;

      case MetricaInsignia.Nodos:
        return metricas.totalNodos;

      case MetricaInsignia.Especial:
      default:
        return null;
    }
  }

  /**
   * Comprueba que una insignia tenga una meta válida.
   */
  private obtenerMeta(insignia: Insignia): number | null {
    if (insignia.meta === null || insignia.meta === undefined) {
      return null;
    }

    const meta = Number(insignia.meta);

    if (!Number.isFinite(meta) || meta <= 0) {
      return null;
    }

    return meta;
  }

  /**
   * Obtiene todas las insignias activas con su
   * estado de desbloqueo y progreso.
   */
  async obtenerInsigniasUsuario(
    usuarioId: number,
  ): Promise<InsigniaEstadoDto[]> {
    const insignias = await this.insigniaRepo.find({
      where: { activa: true },
      order: { id: 'ASC' },
    });

    const obtenidas = await this.usuarioInsigniaRepo.find({
      where: { idUsuario: usuarioId },
    });

    const obtenidasMap = new Map<number, UsuarioInsignia>();

    for (const registro of obtenidas) {
      obtenidasMap.set(registro.idInsignia, registro);
    }

    const metricas = await this.calcularMetricasUsuario(usuarioId);

    return insignias.map((insignia) => {
      const registro = obtenidasMap.get(insignia.id);
      const desbloqueada = Boolean(registro);

      const meta = this.obtenerMeta(insignia);
      const valor = this.obtenerValorMetrica(insignia, metricas);

      let progreso: number | null = null;

      if (valor !== null && meta !== null) {
        progreso = Math.min(
          Math.max(0, valor),
          meta,
        );

        // Mostrar kilómetros con un decimal.
        if (this.obtenerMetrica(insignia) === MetricaInsignia.Km) {
          progreso = Math.round(progreso * 10) / 10;
        }
      }

      return {
        codigo: insignia.codigo,
        nombre: insignia.nombre,
        descripcion: insignia.descripcion,
        emoji: insignia.emoji,
        desbloqueada,
        fechaObtenida: registro
          ? registro.obtenidaEn.toISOString()
          : null,
        progreso,
        meta,
      };
    });
  }

  /**
   * Cuenta las insignias obtenidas por un usuario.
   */
  async contarInsigniasUsuario(
    usuarioId: number,
  ): Promise<number> {
    return this.usuarioInsigniaRepo.count({
      where: { idUsuario: usuarioId },
    });
  }

  /**
   * Otorga una insignia activa si el usuario
   * todavía no la ha desbloqueado.
   *
   * La restricción única de PostgreSQL protege
   * contra registros duplicados.
   */
  async otorgar(
    usuarioId: number,
    codigo: CodigoInsignia | string,
  ): Promise<boolean> {
    let insignia: Insignia;

    try {
      const encontrada = await this.insigniaRepo.findOne({
        where: {
          codigo,
          activa: true,
        },
      });

      if (!encontrada) {
        return false;
      }

      insignia = encontrada;

      const yaObtenida = await this.usuarioInsigniaRepo.findOne({
        where: {
          idUsuario: usuarioId,
          idInsignia: insignia.id,
        },
      });

      if (yaObtenida) {
        return false;
      }

      const registro = this.usuarioInsigniaRepo.create({
        idUsuario: usuarioId,
        idInsignia: insignia.id,
      });

      await this.usuarioInsigniaRepo.save(registro);
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : String(error);

      const stack =
        error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al otorgar insignia ${codigo} al usuario ${usuarioId}: ${detalle}`,
        stack,
      );

      return false;
    }

    // Un fallo de notificación no revierte la insignia obtenida.
    try {
      await this.notificacionesService.crear({
        idUsuario: usuarioId,
        categoria: CategoriaNotificacion.Insignias,
        titulo: `¡Nueva insignia desbloqueada: ${insignia.nombre}!`,
        mensaje: insignia.descripcion,
        referenciaTipo: ReferenciaTipoNotificacion.Insignia,
        referenciaId: insignia.id,
      });
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Insignia ${codigo} otorgada, pero no se pudo notificar al usuario ${usuarioId}: ${detalle}`,
      );
    }

    return true;
  }

  /**
   * Evalúa dinámicamente todas las insignias activas.
   *
   * No requiere agregar condiciones individuales
   * para cada nueva insignia.
   */
  async evaluar(usuarioId: number): Promise<void> {
    try {
      const metricas = await this.calcularMetricasUsuario(usuarioId);

      const insignias = await this.insigniaRepo.find({
        where: { activa: true },
        order: { id: 'ASC' },
      });

      const obtenidas = await this.usuarioInsigniaRepo.find({
        where: { idUsuario: usuarioId },
      });

      const idsObtenidos = new Set(
        obtenidas.map((registro) => registro.idInsignia),
      );

      for (const insignia of insignias) {
        // No intentar otorgar una insignia ya obtenida.
        if (idsObtenidos.has(insignia.id)) {
          continue;
        }

        const meta = this.obtenerMeta(insignia);

        if (meta === null) {
          continue;
        }

        const valor = this.obtenerValorMetrica(
          insignia,
          metricas,
        );

        // Las insignias especiales quedan pendientes
        // hasta implementar su regla de evaluación.
        if (valor === null) {
          continue;
        }

        if (valor >= meta) {
          const otorgada = await this.otorgar(
            usuarioId,
            insignia.codigo,
          );

          if (otorgada) {
            idsObtenidos.add(insignia.id);
          }
        }
      }
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : String(error);

      const stack =
        error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al evaluar insignias para usuario ${usuarioId}: ${detalle}`,
        stack,
      );
    }
  }

  /**
   * Calcula las métricas acumuladas del usuario.
   *
   * Se conserva el criterio original:
   * - Las rutas rechazadas no contabilizan.
   * - Las alertas y nodos se contabilizan por creador.
   */
  private async calcularMetricasUsuario(
    usuarioId: number,
  ): Promise<MetricasUsuario> {
    const rutasRes = await this.insigniaRepo.manager.query(
      `
        SELECT
          COALESCE((SELECT SUM(CAST(distancia_km AS float)) FROM recorridos_rutas WHERE usuario_id = $1), 0) +
          COALESCE((SELECT SUM(CAST(distancia_km AS float)) FROM rutas WHERE creado_por = $1 AND estado != $2), 0) AS km,
          COALESCE((SELECT COUNT(id)::int FROM recorridos_rutas WHERE usuario_id = $1), 0) +
          COALESCE((SELECT COUNT(id)::int FROM rutas WHERE creado_por = $1 AND estado != $2), 0) AS rutas
        `,
      [usuarioId, 'Rechazada'],
    );

    const alertasRes = await this.insigniaRepo.manager.query(
      `
      SELECT COUNT(a.id)::int AS alertas
      FROM alertas a
      WHERE a.creado_por = $1
      `,
      [usuarioId],
    );

    const nodosRes = await this.insigniaRepo.manager.query(
      `
      SELECT COUNT(n.id)::int AS nodos
      FROM nodos n
      WHERE n.creado_por = $1
      `,
      [usuarioId],
    );

    const totalKm = Number(rutasRes[0]?.km ?? 0);
    const totalRutas = Number(rutasRes[0]?.rutas ?? 0);
    const totalAlertas = Number(alertasRes[0]?.alertas ?? 0);
    const totalNodos = Number(nodosRes[0]?.nodos ?? 0);

    return {
      totalKm: Number.isFinite(totalKm) ? totalKm : 0,
      totalRutas: Number.isFinite(totalRutas) ? totalRutas : 0,
      totalAlertas: Number.isFinite(totalAlertas) ? totalAlertas : 0,
      totalNodos: Number.isFinite(totalNodos) ? totalNodos : 0,
    };
  }
}
