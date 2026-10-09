import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../Alertas/alerta.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { CrearReporteContenidoDto } from './dto/crear-reporte-contenido.dto';
import { EstadoReporteContenido } from './estado-reporte-contenido.enum';
import { ReporteContenido } from './reporte-contenido.entity';
import { TipoContenidoReportado } from './tipo-contenido-reportado.enum';

@Injectable()
export class ReporteContenidoService {
  constructor(
    @InjectRepository(ReporteContenido)
    private readonly reporteRepository: Repository<ReporteContenido>,
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
  ) {}

  private async verificarContenido(
    tipo: TipoContenidoReportado,
    id: number,
  ): Promise<void> {
    let existe = false;

    switch (tipo) {
      case TipoContenidoReportado.Ruta:
        existe = await this.rutaRepository.existsBy({ id });
        break;
      case TipoContenidoReportado.Nodo:
        existe = await this.nodoRepository.existsBy({ id });
        break;
      case TipoContenidoReportado.Alerta:
        existe = await this.alertaRepository.existsBy({ id });
        break;
      default:
        throw new NotFoundException('Tipo de contenido no valido');
    }

    if (!existe) {
      throw new NotFoundException('El contenido denunciado no existe');
    }
  }

  async crear(
    dto: CrearReporteContenidoDto,
    usuarioId: number,
  ): Promise<ReporteContenido> {
    await this.verificarContenido(dto.tipoContenido, dto.contenidoId);

    const reporte = this.reporteRepository.create({
      tipoContenido: dto.tipoContenido,
      contenidoId: dto.contenidoId,
      motivo: dto.motivo,
      descripcion: dto.descripcion ?? null,
      reportadoPor: { id: usuarioId },
      estado: EstadoReporteContenido.Pendiente,
      resueltoEn: null,
    });

    return this.reporteRepository.save(reporte);
  }

  listar(): Promise<ReporteContenido[]> {
    return this.reporteRepository.find({
      select: { reportadoPor: { id: true, nombreUser: true } },
      relations: { reportadoPor: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtener(id: number): Promise<ReporteContenido> {
    const reporte = await this.reporteRepository.findOne({
      where: { id },
      select: { reportadoPor: { id: true, nombreUser: true } },
      relations: { reportadoPor: true },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }

    return reporte;
  }

  async cambiarEstado(
    id: number,
    estado: EstadoReporteContenido,
  ): Promise<ReporteContenido> {
    const reporte = await this.obtener(id);

    reporte.estado = estado;
    reporte.resueltoEn =
      estado === EstadoReporteContenido.Pendiente ? null : new Date();

    return this.reporteRepository.save(reporte);
  }
}

