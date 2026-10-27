
import {
  BadRequestException,
  ConflictException,
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
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
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

  async consultarPlanes(pais?: string) {
    const moneda = monedaParaPais(pais);

    const planes = await this.planesRepository.find({
      where: { activo: true },
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
          duracionDias: plan.duracionDias,
          moneda: precio.moneda,
          importe: precio.importe,
        };
      });

    return {
      pais: pais?.trim().toUpperCase() || null,
      moneda,
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

    return {
      id: suscripcion.id,
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

  async solicitarSuscripcion(
    usuarioId: number,
    dto: SolicitarSuscripcionDto,
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

    const nuevaSuscripcion = this.suscripcionesRepository.create({
      usuarioId,
      planId: plan.id,
      estado: EstadoSuscripcion.Solicitada,
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
