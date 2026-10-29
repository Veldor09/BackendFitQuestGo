
import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { AuditoriaService } from '../Auditoria/auditoria.service';
import { monedaParaPais } from './monedas';
import {
  type AudienciaPlan,
  audienciaParaRol,
  metodoPagoParaPais,
  pagoDisponible,
  SINPE_MOVIL_NUMERO,
} from './pago';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { User } from '../Usuarios/user.entity';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import {
  EstadoSuscripcion,
  Suscripcion,
} from './suscripcion.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { SolicitarSuscripcionDto } from './solicitar-suscripcion.dto';
import { RechazarSuscripcionDto } from './rechazar-suscripcion.dto';

const PG_UNIQUE_VIOLATION = '23505';

/** Intentos para dar con un numero de solicitud libre antes de rendirse. */
const INTENTOS_NUMERO_SOLICITUD = 8;

/** Cuantas solicitudes ve el admin de una vez (las mas recientes primero). */
const LIMITE_LISTADO_ADMIN = 200;

export interface FiltroSuscripciones {
  estado?: string;
  /** Busca por numero de solicitud, nombre o correo. */
  q?: string;
}

@Injectable()
export class SuscripcionesService {
  constructor(
    @InjectRepository(PlanPatrocinio)
    private readonly planesRepository: Repository<PlanPatrocinio>,

    @InjectRepository(PrecioPatrocinio)
    private readonly preciosRepository: Repository<PrecioPatrocinio>,

    @InjectRepository(Suscripcion)
    private readonly suscripcionesRepository: Repository<Suscripcion>,

    @InjectRepository(RenovacionSuscripcion)
    private readonly renovacionesRepository: Repository<RenovacionSuscripcion>,

    private readonly auditoriaService: AuditoriaService,

    private readonly dataSource: DataSource,

    // Avisa al dueno del plan (campana + aviso del telefono) cuando el admin
    // aprueba o rechaza. Opcional: sin el, aprobar y rechazar funcionan igual.
    @Optional()
    private readonly avisos?: PatrocinioAvisosService,
  ) {}

  /**
   * Los planes que se pueden pedir desde [pais]. Con [audiencia] solo salen los
   * de esa clase de cuenta (`empresa` o `usuario`); sin ella, todos.
   */
  async consultarPlanes(pais?: string, audiencia?: AudienciaPlan) {
    const moneda = monedaParaPais(pais);
    const metodoPago = metodoPagoParaPais(pais);

    const planes = await this.planesRepository.find({
      where: audiencia ? { activo: true, audiencia } : { activo: true },
      order: { id: 'ASC' },
    });

    const precios = await this.preciosRepository.find({
      where: {
        moneda,
        activo: true,
      },
    });

    const preciosPorPlan = new Map(
      precios.map((precio) => [precio.planId, precio]),
    );

    const planesDisponibles = planes
      .filter((plan) => preciosPorPlan.has(plan.id))
      .map((plan) => {
        const precio = preciosPorPlan.get(plan.id)!;

        return {
          id: plan.id,
          nombre: plan.nombre,
          audiencia: plan.audiencia,
          duracionDias: plan.duracionDias,
          moneda: precio.moneda,
          importe: precio.importe,
        };
      });

    return {
      pais: pais?.trim().toUpperCase() || null,
      moneda,
      metodoPago,
      // PayPal (resto del mundo) aun no esta configurado: se ven los planes pero
      // todavia no se pueden solicitar.
      pagoDisponible: pagoDisponible(metodoPago),
      sinpeNumero: metodoPago === 'sinpe' ? SINPE_MOVIL_NUMERO : null,
      planes: planesDisponibles,
    };
  }

  /**
   * La suscripcion mas reciente de la persona (o `null` si nunca pidio una):
   * es lo que la app muestra en "Plan de patrocinio". `vigente` es lo que
   * manda para destacar: activa Y sin vencer (el estado solo cambia cuando
   * alguien lo actualiza, la fecha no miente).
   */
  async miSuscripcion(usuarioId: number) {
    const suscripcion = await this.suscripcionesRepository.findOne({
      where: { usuarioId },
      order: { creadoEn: 'DESC', id: 'DESC' },
    });
    if (!suscripcion) return null;

    const plan = await this.planesRepository.findOne({
      where: { id: suscripcion.planId },
    });

    // El monto a transferir: lo aplicado al aprobar o, mientras espera, el precio
    // vigente del plan en esa moneda.
    const precio =
      suscripcion.precioAplicado ??
      (
        await this.preciosRepository.findOne({
          where: {
            planId: suscripcion.planId,
            moneda: suscripcion.moneda,
            activo: true,
          },
        })
      )?.importe ??
      null;
    const metodoPago = metodoPagoParaPais(suscripcion.pais);

    return {
      id: suscripcion.id,
      numeroSolicitud: suscripcion.numeroSolicitud,
      audiencia: plan?.audiencia ?? null,
      monto: precio,
      metodoPago,
      sinpeNumero: metodoPago === 'sinpe' ? SINPE_MOVIL_NUMERO : null,
      estado: suscripcion.estado,
      vigente:
        suscripcion.estado === EstadoSuscripcion.Activa &&
        suscripcion.venceEn != null &&
        suscripcion.venceEn.getTime() > Date.now(),
      planId: suscripcion.planId,
      planNombre: plan?.nombre ?? null,
      moneda: suscripcion.moneda,
      precioAplicado: suscripcion.precioAplicado,
      iniciaEn: suscripcion.iniciaEn,
      venceEn: suscripcion.venceEn,
      creadoEn: suscripcion.creadoEn,
    };
  }

  /**
   * Gestion de suscripciones (admin): las solicitudes y planes, las mas nuevas
   * primero. [filtro.q] busca por numero de solicitud, nombre o correo.
   */
  async listarSuscripciones(filtro: FiltroSuscripciones = {}) {
    const consulta = this.suscripcionesRepository
      .createQueryBuilder('s')
      .innerJoin(User, 'u', 'u.id = s.usuarioId')
      .innerJoin(PlanPatrocinio, 'p', 'p.id = s.planId')
      .leftJoin(
        PrecioPatrocinio,
        'pr',
        'pr.planId = s.planId AND pr.moneda = s.moneda AND pr.activo = true',
      )
      .select([
        's.id AS id',
        's.numeroSolicitud AS "numeroSolicitud"',
        's.estado AS estado',
        's.pais AS pais',
        's.moneda AS moneda',
        'COALESCE(s.precioAplicado, pr.importe) AS monto',
        's.iniciaEn AS "iniciaEn"',
        's.venceEn AS "venceEn"',
        's.creadoEn AS "creadoEn"',
        'u.id AS "usuarioId"',
        'u.nombreUser AS "usuarioNombre"',
        'u.emailUser AS "usuarioEmail"',
        'u.idrol AS "usuarioRol"',
        'p.id AS "planId"',
        'p.nombre AS "planNombre"',
        'p.audiencia AS "planAudiencia"',
      ])
      .orderBy('s.creadoEn', 'DESC')
      .addOrderBy('s.id', 'DESC')
      .limit(LIMITE_LISTADO_ADMIN);

    if (filtro.estado) {
      consulta.andWhere('s.estado = :estado', { estado: filtro.estado });
    }
    const q = filtro.q?.trim();
    if (q) {
      consulta.andWhere(
        '(s.numeroSolicitud = :exacto OR u.nombreUser ILIKE :parcial OR u.emailUser ILIKE :parcial)',
        { exacto: q, parcial: `%${q}%` },
      );
    }

    return consulta.getRawMany();
  }

  /** Un plan activo se suspende (p. ej. un pago devuelto): deja de valer ya. */
  async suspenderSuscripcion(
    suscripcionId: number,
    administradorId: number,
  ) {
    const suspendida = await this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Suscripcion);
      const suscripcion = await repositorio.findOne({
        where: { id: suscripcionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!suscripcion) {
        throw new NotFoundException('La suscripcion no existe');
      }
      if (suscripcion.estado !== EstadoSuscripcion.Activa) {
        throw new ConflictException(
          'Solo se pueden suspender suscripciones activas',
        );
      }

      suscripcion.estado = EstadoSuscripcion.Suspendida;
      suscripcion.administradorId = administradorId;
      await repositorio.save(suscripcion);

      await this.auditoriaService.registrar(
        {
          administradorId,
          accion: 'SUSPENDER_SUSCRIPCION',
          entidad: 'suscripciones',
          entidadId: suscripcion.id,
          detalle: {
            usuarioId: suscripcion.usuarioId,
            planId: suscripcion.planId,
            estadoAnterior: EstadoSuscripcion.Activa,
            estadoNuevo: EstadoSuscripcion.Suspendida,
          },
        },
        manager,
      );

      return {
        id: suscripcion.id,
        usuarioId: suscripcion.usuarioId,
        estado: suscripcion.estado,
        mensaje: 'Suscripcion suspendida correctamente',
      };
    });

    await this.avisos?.planSuspendido(suspendida.usuarioId, suspendida.id);
    return suspendida;
  }

  /** Un numero de 6 digitos que ninguna solicitud tenga todavia. */
  private async nuevoNumeroSolicitud(): Promise<string> {
    for (let i = 0; i < INTENTOS_NUMERO_SOLICITUD; i++) {
      const numero = String(randomInt(100000, 1000000));
      const existe = await this.suscripcionesRepository.findOne({
        where: { numeroSolicitud: numero },
      });
      if (!existe) return numero;
    }
    throw new ConflictException(
      'No se pudo generar el numero de solicitud, intentalo de nuevo',
    );
  }

  async solicitarSuscripcion(
    usuarioId: number,
    dto: SolicitarSuscripcionDto,
    /** Rol de quien pide: un plan de empresa no es para un usuario y al reves. */
    rol?: number,
  ) {
    const plan = await this.planesRepository.findOne({
      where: {
        id: dto.planId,
        activo: true,
      },
    });

    if (!plan) {
      throw new NotFoundException(
        'El plan de patrocinio no existe o no esta disponible',
      );
    }

    if (rol !== undefined && plan.audiencia !== audienciaParaRol(rol)) {
      throw new ForbiddenException('PLAN_NO_APLICA');
    }

    const metodoPago = metodoPagoParaPais(dto.pais);
    if (!pagoDisponible(metodoPago)) {
      // PayPal todavia no esta configurado.
      throw new BadRequestException('PAGO_NO_DISPONIBLE');
    }

    const moneda = monedaParaPais(dto.pais);

    const precio = await this.preciosRepository.findOne({
      where: {
        planId: plan.id,
        moneda,
        activo: true,
      },
    });

    if (!precio) {
      throw new NotFoundException(
        'El plan no tiene un precio disponible para la moneda correspondiente',
      );
    }

    const suscripcionExistente =
      await this.suscripcionesRepository.findOne({
        where: [
          {
            usuarioId,
            estado: EstadoSuscripcion.Solicitada,
          },
          {
            usuarioId,
            estado: EstadoSuscripcion.Activa,
          },
        ],
      });

    if (suscripcionExistente) {
      throw new ConflictException(
        'Ya tiene una solicitud pendiente o una suscripcion activa',
      );
    }

    const numeroSolicitud = await this.nuevoNumeroSolicitud();

    const nuevaSuscripcion = this.suscripcionesRepository.create({
      usuarioId,
      planId: plan.id,
      estado: EstadoSuscripcion.Solicitada,
      numeroSolicitud,
      pais: dto.pais,
      moneda,
      precioAplicado: null,
      iniciaEn: null,
      venceEn: null,
      administradorId: null,
    });

    try {
      const suscripcionGuardada =
        await this.suscripcionesRepository.save(nuevaSuscripcion);

      return {
        id: suscripcionGuardada.id,
        usuarioId: suscripcionGuardada.usuarioId,
        planId: suscripcionGuardada.planId,
        estado: suscripcionGuardada.estado,
        numeroSolicitud: suscripcionGuardada.numeroSolicitud,
        monto: precio.importe,
        metodoPago,
        sinpeNumero: SINPE_MOVIL_NUMERO,
        pais: suscripcionGuardada.pais,
        moneda: suscripcionGuardada.moneda,
        creadoEn: suscripcionGuardada.creadoEn,
        mensaje: 'Solicitud de patrocinio registrada correctamente',
      };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const codigo =
          (error as QueryFailedError & {
            code?: string;
            driverError?: { code?: string };
          }).driverError?.code ??
          (error as QueryFailedError & {
            code?: string;
          }).code;

        if (codigo === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            'Ya tiene una solicitud pendiente o una suscripcion activa',
          );
        }
      }

      throw error;
    }
  }

  async aprobarSuscripcion(
    suscripcionId: number,
    administradorId: number,
  ) {
    const aprobada = await this.dataSource.transaction(async (manager) => {
      const suscripcionesRepository =
        manager.getRepository(Suscripcion);

      const suscripcion =
        await suscripcionesRepository.findOne({
          where: { id: suscripcionId },
          lock: { mode: 'pessimistic_write' },
        });

      if (!suscripcion) {
        throw new NotFoundException(
          'La suscripcion no existe',
        );
      }

      if (suscripcion.estado !== EstadoSuscripcion.Solicitada) {
        throw new ConflictException(
          'Solo se pueden aprobar solicitudes pendientes',
        );
      }

      const plan = await manager
        .getRepository(PlanPatrocinio)
        .findOne({
          where: {
            id: suscripcion.planId,
            activo: true,
          },
        });

      if (!plan) {
        throw new NotFoundException(
          'El plan de patrocinio no existe o no esta disponible',
        );
      }

      const precio = await manager
        .getRepository(PrecioPatrocinio)
        .findOne({
          where: {
            planId: plan.id,
            moneda: suscripcion.moneda,
            activo: true,
          },
        });

      if (!precio) {
        throw new NotFoundException(
          'El plan no tiene un precio activo para la moneda de la solicitud',
        );
      }

      const inicio = new Date();
      const vencimiento = new Date(inicio);

      vencimiento.setUTCDate(
        vencimiento.getUTCDate() + plan.duracionDias,
      );

      suscripcion.estado = EstadoSuscripcion.Activa;
      suscripcion.precioAplicado = precio.importe;
      suscripcion.iniciaEn = inicio;
      suscripcion.venceEn = vencimiento;
      suscripcion.administradorId = administradorId;

      await suscripcionesRepository.save(suscripcion);

      await this.auditoriaService.registrar(
        {
          administradorId,
          accion: 'APROBAR_SUSCRIPCION',
          entidad: 'suscripciones',
          entidadId: suscripcion.id,
          detalle: {
            usuarioId: suscripcion.usuarioId,
            planId: suscripcion.planId,
            moneda: suscripcion.moneda,
            precioAplicado: suscripcion.precioAplicado,
            iniciaEn: inicio.toISOString(),
            venceEn: vencimiento.toISOString(),
          },
        },
        manager,
      );

      return {
        id: suscripcion.id,
        usuarioId: suscripcion.usuarioId,
        planId: suscripcion.planId,
        estado: suscripcion.estado,
        moneda: suscripcion.moneda,
        precioAplicado: suscripcion.precioAplicado,
        iniciaEn: suscripcion.iniciaEn,
        venceEn: suscripcion.venceEn,
        administradorId: suscripcion.administradorId,
        audiencia: plan.audiencia,
        mensaje: 'Suscripcion aprobada correctamente',
      };
    });

    // Ya confirmada la aprobacion: el aviso no puede deshacerla ni hacerla fallar.
    await this.avisos?.planAprobado(
      aprobada.usuarioId,
      aprobada.id,
      Math.round(
        (aprobada.venceEn.getTime() - aprobada.iniciaEn.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
      aprobada.audiencia,
    );
    return aprobada;
  }

  async rechazarSuscripcion(
    suscripcionId: number,
    administradorId: number,
    dto: RechazarSuscripcionDto,
  ) {
    const motivo = dto.motivo?.trim();

    if (!motivo || motivo.length < 10 || motivo.length > 500) {
      throw new BadRequestException(
        'El motivo del rechazo debe contener entre 10 y 500 caracteres',
      );
    }

    const rechazada = await this.dataSource.transaction(async (manager) => {
      const suscripcionesRepository =
        manager.getRepository(Suscripcion);

      const suscripcion =
        await suscripcionesRepository.findOne({
          where: { id: suscripcionId },
          lock: { mode: 'pessimistic_write' },
        });

      if (!suscripcion) {
        throw new NotFoundException(
          'La suscripcion no existe',
        );
      }

      if (suscripcion.estado !== EstadoSuscripcion.Solicitada) {
        throw new ConflictException(
          'Solo se pueden rechazar solicitudes pendientes',
        );
      }

      suscripcion.estado = EstadoSuscripcion.Rechazada;
      suscripcion.administradorId = administradorId;

      await suscripcionesRepository.save(suscripcion);

      await this.auditoriaService.registrar(
        {
          administradorId,
          accion: 'RECHAZAR_SUSCRIPCION',
          entidad: 'suscripciones',
          entidadId: suscripcion.id,
          detalle: {
            usuarioId: suscripcion.usuarioId,
            planId: suscripcion.planId,
            estadoAnterior: EstadoSuscripcion.Solicitada,
            estadoNuevo: EstadoSuscripcion.Rechazada,
            motivo,
          },
        },
        manager,
      );

      return {
        id: suscripcion.id,
        usuarioId: suscripcion.usuarioId,
        planId: suscripcion.planId,
        estado: suscripcion.estado,
        administradorId: suscripcion.administradorId,
        motivo,
        mensaje: 'Suscripcion rechazada correctamente',
      };
    });

    await this.avisos?.planRechazado(
      rechazada.usuarioId,
      rechazada.id,
      motivo,
    );
    return rechazada;
  }
}
