
import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
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
  type MetodoPago,
  audienciaParaRol,
  metodoPagoParaPais,
  pagoDisponible,
} from './pago';
import { PASARELA_PAGOS, type PasarelaPagos } from './pasarela-pagos';
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

    // La pasarela que cobra en linea (ONVO). Sin ella, pagar no esta disponible.
    @Optional()
    @Inject(PASARELA_PAGOS)
    private readonly pasarela?: PasarelaPagos,
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
      // PayPal (resto del mundo) aun no esta configurado y ONVO necesita sus
      // llaves: sin ellas se ven los planes pero todavia no se puede pagar.
      pagoDisponible: this.puedeCobrar(metodoPago),
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
    const buscar = () =>
      this.suscripcionesRepository.findOne({
        where: { usuarioId },
        order: { creadoEn: 'DESC', id: 'DESC' },
      });
    let suscripcion = await buscar();
    if (!suscripcion) return null;

    // Un pago en linea en curso se confirma al consultarlo: ONVO marca la sesion
    // como pagada un instante DESPUES de devolver a la persona a la app, y el
    // webhook puede no llegar (o tardar). Asi no depende de el.
    if (
      suscripcion.estado === EstadoSuscripcion.Solicitada &&
      suscripcion.pagoRef
    ) {
      try {
        if ((await this.confirmarPago(suscripcion.id)) === 'activada') {
          suscripcion = (await buscar()) ?? suscripcion;
        }
      } catch {
        // La pasarela no respondio: se devuelve lo que hay, sin fallar.
      }
    }

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

    return {
      id: suscripcion.id,
      numeroSolicitud: suscripcion.numeroSolicitud,
      audiencia: plan?.audiencia ?? null,
      monto: precio,
      // Con referencia es un pago en linea; sin ella, una solicitud manual de antes.
      pagoEnLinea: suscripcion.pagoRef != null,
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
        's.pagoRef AS "pagoRef"',
        's.pagadaEn AS "pagadaEn"',
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

  /**
   * Se puede cobrar con este metodo: ONVO necesita sus llaves y PayPal todavia
   * no esta configurado.
   */
  private puedeCobrar(metodo: MetodoPago): boolean {
    return (
      pagoDisponible(metodo) &&
      (metodo !== 'onvo' || this.pasarela?.disponible === true)
    );
  }

  /**
   * Empieza un pago en linea: deja la solicitud en `Solicitada`, crea la sesion de
   * pago en la pasarela y devuelve su URL. El monto sale siempre del precio del
   * plan, nunca de lo que mande la app. El plan se activa solo cuando el pago se
   * confirma (`confirmarPago`).
   */
  async iniciarPago(
    usuarioId: number,
    dto: SolicitarSuscripcionDto,
    /** Rol de quien paga: un plan de empresa no es para un usuario y al reves. */
    rol: number | undefined,
    urls: { retorno: (suscripcionId: number) => string; cancelado: string },
  ): Promise<{ suscripcionId: number; numeroSolicitud: string; url: string }> {
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
    if (!this.puedeCobrar(metodoPago) || !this.pasarela) {
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

    const yaActiva = await this.suscripcionesRepository.findOne({
      where: { usuarioId, estado: EstadoSuscripcion.Activa },
    });
    if (yaActiva) {
      // Nada marca como vencidas las suscripciones: una Activa con la fecha
      // pasada ya no vale y no debe impedir renovar.
      if (yaActiva.venceEn && yaActiva.venceEn.getTime() <= Date.now()) {
        yaActiva.estado = EstadoSuscripcion.Vencida;
        await this.suscripcionesRepository.save(yaActiva);
      } else {
        throw new ConflictException(
          'Ya tiene una solicitud pendiente o una suscripcion activa',
        );
      }
    }

    const pendiente = await this.suscripcionesRepository.findOne({
      where: { usuarioId, estado: EstadoSuscripcion.Solicitada },
    });
    if (pendiente) {
      // Una solicitud manual en revision sigue su curso; un pago en linea que
      // nunca se completo no debe trabar un nuevo intento.
      if (pendiente.pagoRef == null) {
        throw new ConflictException(
          'Ya tiene una solicitud pendiente o una suscripcion activa',
        );
      }

      // Antes de cerrarlo hay que preguntar a la pasarela: un pago que ONVO aun
      // no marcaba como pagado (SINPE) puede haberse completado, y cerrarlo
      // dejaria a la persona cobrada y sin plan.
      let estadoPago: Awaited<ReturnType<SuscripcionesService['confirmarPago']>>;
      try {
        estadoPago = await this.confirmarPago(pendiente.id);
      } catch {
        throw new ServiceUnavailableException('PAGO_ERROR');
      }
      if (estadoPago === 'activada' || estadoPago === 'ya_activa') {
        throw new ConflictException(
          'Ya tiene una solicitud pendiente o una suscripcion activa',
        );
      }
      await this.cerrarSiSigueSolicitada(pendiente.id);
    }

    const usuario = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new NotFoundException('El usuario no existe');
    }

    const numeroSolicitud = await this.nuevoNumeroSolicitud();

    let guardada: Suscripcion;
    try {
      guardada = await this.suscripcionesRepository.save(
        this.suscripcionesRepository.create({
          usuarioId,
          planId: plan.id,
          estado: EstadoSuscripcion.Solicitada,
          numeroSolicitud,
          pagoRef: null,
          pagadaEn: null,
          pais: dto.pais,
          moneda,
          // El precio que se cobra es el de este momento, aunque el plan cambie.
          precioAplicado: precio.importe,
          iniciaEn: null,
          venceEn: null,
          administradorId: null,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const codigo =
          (
            error as QueryFailedError & {
              code?: string;
              driverError?: { code?: string };
            }
          ).driverError?.code ?? (error as QueryFailedError & { code?: string }).code;

        if (codigo === PG_UNIQUE_VIOLATION) {
          throw new ConflictException(
            'Ya tiene una solicitud pendiente o una suscripcion activa',
          );
        }
      }

      throw error;
    }

    try {
      const sesion = await this.pasarela.crearSesion({
        monto: Number(precio.importe),
        moneda: 'CRC',
        descripcion: `${plan.nombre} #${numeroSolicitud}`,
        clienteNombre: usuario.nombreUser,
        clienteEmail: usuario.emailUser,
        redirectUrl: urls.retorno(guardada.id),
        cancelUrl: urls.cancelado,
        metadata: {
          suscripcionId: String(guardada.id),
          numeroSolicitud,
        },
      });

      guardada.pagoRef = sesion.id;
      await this.suscripcionesRepository.save(guardada);

      return {
        suscripcionId: guardada.id,
        numeroSolicitud,
        url: sesion.url,
      };
    } catch {
      // La pasarela fallo: la solicitud no sirve y no debe trabar el siguiente intento.
      guardada.estado = EstadoSuscripcion.Rechazada;
      await this.suscripcionesRepository.save(guardada);
      throw new ServiceUnavailableException('PAGO_ERROR');
    }
  }

  /**
   * Confirma un pago en linea preguntandole a la pasarela (nunca confiando en lo
   * que llegue en la URL ni en el cuerpo del webhook). Si esta pagado, activa el
   * plan: es seguro llamarlo varias veces (retorno + webhook) porque solo la
   * primera activa y avisa.
   */
  async confirmarPago(
    suscripcionId: number,
  ): Promise<'activada' | 'ya_activa' | 'pendiente' | 'no_encontrada'> {
    const suscripcion = await this.suscripcionesRepository.findOne({
      where: { id: suscripcionId },
    });
    if (!suscripcion || !suscripcion.pagoRef) return 'no_encontrada';
    if (suscripcion.estado === EstadoSuscripcion.Activa) return 'ya_activa';
    if (suscripcion.estado !== EstadoSuscripcion.Solicitada || !this.pasarela) {
      return 'pendiente';
    }

    const sesion = await this.pasarela.obtenerSesion(suscripcion.pagoRef);
    if (!sesion.pagada) return 'pendiente';

    const plan = await this.planesRepository.findOne({
      where: { id: suscripcion.planId },
    });
    const duracionDias = plan?.duracionDias ?? 30;

    const resultado = await this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Suscripcion);
      const bloqueada = await repositorio.findOne({
        where: { id: suscripcionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bloqueada) return 'no_encontrada' as const;
      if (bloqueada.estado === EstadoSuscripcion.Activa) {
        return 'ya_activa' as const;
      }
      if (bloqueada.estado !== EstadoSuscripcion.Solicitada) {
        return 'pendiente' as const;
      }

      const ahora = new Date();
      const vencimiento = new Date(ahora);
      vencimiento.setUTCDate(vencimiento.getUTCDate() + duracionDias);

      bloqueada.estado = EstadoSuscripcion.Activa;
      bloqueada.iniciaEn = ahora;
      bloqueada.venceEn = vencimiento;
      bloqueada.pagadaEn = ahora;
      bloqueada.administradorId = null;
      await repositorio.save(bloqueada);

      return 'activada' as const;
    });

    // Ya confirmada la activacion: el aviso no puede deshacerla ni hacerla fallar.
    if (resultado === 'activada') {
      await this.avisos?.planAprobado(
        suscripcion.usuarioId,
        suscripcion.id,
        duracionDias,
        plan?.audiencia ?? 'usuario',
      );
    }
    return resultado;
  }

  /**
   * Cierra un pago en linea que no se completo, solo si sigue `Solicitada`: si
   * otra llamada la activo mientras tanto, no se pisa.
   */
  private async cerrarSiSigueSolicitada(suscripcionId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Suscripcion);
      const actual = await repositorio.findOne({
        where: { id: suscripcionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (actual && actual.estado === EstadoSuscripcion.Solicitada) {
        actual.estado = EstadoSuscripcion.Rechazada;
        await repositorio.save(actual);
      }
    });
  }

  /** El webhook trae la sesion de ONVO: se busca su solicitud y se confirma. */
  async confirmarPorSesion(sesionId: string): Promise<void> {
    const suscripcion = await this.suscripcionesRepository.findOne({
      where: { pagoRef: sesionId },
    });
    if (suscripcion) await this.confirmarPago(suscripcion.id);
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

      // Un pago en linea en curso se cierra solo (o se activa al confirmarse): si un
      // admin lo rechazara y luego se pagara, la persona quedaria cobrada sin plan.
      if (suscripcion.pagoRef != null) {
        throw new ConflictException(
          'Un pago en linea en curso no se puede rechazar a mano',
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
