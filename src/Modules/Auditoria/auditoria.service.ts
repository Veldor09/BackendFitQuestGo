
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
      .createQueryBuilder('auditoria')
      .where('auditoria.archivado = :archivado', {
        archivado: false,
      });

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

  /**
   * Archiva un registro sin eliminarlo de PostgreSQL.
   * Guarda el administrador responsable y la fecha.
   */
  async archivar(
    id: number,
    administradorId: number,
  ) {
    const resultado = await this.auditoriaRepository
      .createQueryBuilder()
      .update(RegistroAuditoria)
      .set({
        archivado: true,
        archivadoPor: administradorId,
        archivadoEn: new Date(),
      })
      .where('id = :id', { id })
      .andWhere('archivado = :archivado', {
        archivado: false,
      })
      .execute();

    if (resultado.affected === 0) {
      const registro = await this.auditoriaRepository.findOne({
        where: { id },
      });

      if (!registro) {
        throw new NotFoundException(
          'El registro de auditoría no existe',
        );
      }

      throw new ConflictException(
        'Este registro de auditoría ya fue archivado',
      );
    }

    return {
      mensaje: 'Registro de auditoría archivado correctamente',
      id,
      archivado: true,
    };
  }
}
