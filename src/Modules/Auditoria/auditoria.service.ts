
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';
import { RegistroAuditoria } from './registro-auditoria.entity';

export interface NuevaAccionAuditoria {
  administradorId: number;
  accion: string;
  entidad: string;
  entidadId?: number | null;
  detalle?: Record<string, unknown> | null;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(RegistroAuditoria)
    private readonly auditoriaRepository: Repository<RegistroAuditoria>,
  ) {}

  registrar(
    datos: NuevaAccionAuditoria,
    manager?: EntityManager,
  ): Promise<RegistroAuditoria> {
    const repositorio = manager
      ? manager.getRepository(RegistroAuditoria)
      : this.auditoriaRepository;

    const registro = repositorio.create({
      administradorId: datos.administradorId,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId ?? null,
      detalle: datos.detalle ?? null,
      archivado: false,
      archivadoPor: null,
      archivadoEn: null,
    });

    return repositorio.save(registro);
  }

  /**
   * Consulta todos los registros de auditoría.
   * Incluye los registros archivados anteriormente.
   * Mantiene los filtros y la paginación.
   */
  async consultar(filtros: ConsultarAuditoriaDto) {
    const {
      administradorId,
      accion,
      entidad,
      fechaDesde,
      fechaHasta,
      pagina = 1,
      limite = 20,
    } = filtros;

    if (
      fechaDesde &&
      fechaHasta &&
      new Date(fechaDesde) > new Date(fechaHasta)
    ) {
      throw new BadRequestException(
        'La fecha inicial no puede ser posterior a la fecha final',
      );
    }

    const consulta = this.auditoriaRepository
      .createQueryBuilder('auditoria');

    if (administradorId !== undefined) {
      consulta.andWhere(
        'auditoria.administradorId = :administradorId',
        { administradorId },
      );
    }

    if (accion) {
      consulta.andWhere('auditoria.accion = :accion', {
        accion,
      });
    }

    if (entidad) {
      consulta.andWhere('auditoria.entidad = :entidad', {
        entidad,
      });
    }

    if (fechaDesde) {
      consulta.andWhere(
        'auditoria.creadoEn >= :fechaDesde',
        { fechaDesde },
      );
    }

    if (fechaHasta) {
      consulta.andWhere(
        'auditoria.creadoEn <= :fechaHasta',
        { fechaHasta },
      );
    }

    const [registros, total] = await consulta
      .orderBy('auditoria.creadoEn', 'DESC')
      .addOrderBy('auditoria.id', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    return {
      registros,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }
}
