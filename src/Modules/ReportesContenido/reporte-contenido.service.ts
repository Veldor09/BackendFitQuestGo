import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { esViolacionDeUnicidad } from '../../common/postgres';
import { Alerta } from '../Alertas/alerta.entity';
import { EstadoAlerta } from '../Alertas/estado-alerta.enum';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { MailService } from '../Auth/services/mail.service';
import { Evento } from '../Eventos/evento.entity';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { NodoFoto } from '../Nodos/nodo-foto.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { EventoFoto } from '../Eventos/evento-foto.entity';
import { EstadoRuta } from '../Rutas/estado-ruta.enum';
import { Ruta } from '../Rutas/ruta.entity';
import { CrearReporteContenidoDto } from './dto/crear-reporte-contenido.dto';
import { EstadoReporteContenido } from './estado-reporte-contenido.enum';
import { MotivoReporte } from './motivo-reporte.enum';
import { ReporteContenido } from './reporte-contenido.entity';
import {
  AccionResolverReporte,
  ResolucionReporte,
} from './resolucion-reporte.enum';
import { TipoContenidoReportado } from './tipo-contenido-reportado.enum';

export interface ContenidoReportado {
  nombre: string;
  estado: string;
  creadoPorId: number | null;
  creadoPorNombre: string | null;
  conFoto: boolean;
  desactivado: boolean;
}

export type ReporteConContenido = ReporteContenido & {
  contenido: ContenidoReportado | null;
};

const ARTICULO: Record<TipoContenidoReportado, string> = {
  [TipoContenidoReportado.Nodo]: 'el nodo',
  [TipoContenidoReportado.Ruta]: 'la ruta',
  [TipoContenidoReportado.Alerta]: 'la alerta',
  [TipoContenidoReportado.Evento]: 'el evento',
};

const NOMBRE_ALERTA: Record<string, string> = {
  arbol_caido: 'Árbol caído',
  bache: 'Bache',
  derrumbe: 'Derrumbe',
  inundacion: 'Inundación',
  perro: 'Perro agresivo',
  via_cerrada: 'Vía cerrada',
  accidente: 'Accidente',
  zona_insegura: 'Zona insegura',
  cable_caido: 'Cable caído',
  otro: 'Otro',
};

@Injectable()
export class ReporteContenidoService {
  private readonly logger = new Logger(ReporteContenidoService.name);

  constructor(
    @InjectRepository(ReporteContenido)
    private readonly reporteRepository: Repository<ReporteContenido>,
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
    @InjectRepository(NodoFoto)
    private readonly nodoFotoRepository: Repository<NodoFoto>,
    @InjectRepository(EventoFoto)
    private readonly eventoFotoRepository: Repository<EventoFoto>,
    private readonly mail: MailService,
  ) {}

  private async cargarContenido(
    tipo: TipoContenidoReportado,
    id: number,
  ): Promise<ContenidoReportado | null> {
    const lista = await this.cargarContenidos(tipo, [id]);
    return lista.get(id) ?? null;
  }

  private async cargarContenidos(
    tipo: TipoContenidoReportado,
    ids: number[],
  ): Promise<Map<number, ContenidoReportado>> {
    const resultado = new Map<number, ContenidoReportado>();
    if (ids.length === 0) return resultado;

    switch (tipo) {
      case TipoContenidoReportado.Nodo: {
        for (const n of await this.nodoRepository.find({
          where: { id: In(ids) },
        })) {
          resultado.set(n.id, {
            nombre: n.nombre,
            estado: n.estado,
            creadoPorId: n.creadoPor?.id ?? null,
            creadoPorNombre: n.creadoPor?.nombreUser ?? null,
            conFoto: n.conFoto,
            desactivado: n.estado === EstadoNodo.Rechazado,
          });
        }
        break;
      }
      case TipoContenidoReportado.Ruta: {
        for (const r of await this.rutaRepository.find({
          where: { id: In(ids) },
        })) {
          resultado.set(r.id, {
            nombre: r.nombre,
            estado: r.estado,
            creadoPorId: r.creadoPor?.id ?? null,
            creadoPorNombre: r.creadoPor?.nombreUser ?? null,
            conFoto: r.conFoto,
            desactivado: r.estado === EstadoRuta.Rechazada,
          });
        }
        break;
      }
      case TipoContenidoReportado.Alerta: {
        for (const a of await this.alertaRepository.find({
          where: { id: In(ids) },
        })) {
          resultado.set(a.id, {
            nombre: NOMBRE_ALERTA[a.tipo] ?? a.tipo,
            estado: a.estado,
            creadoPorId: a.creadoPor?.id ?? null,
            creadoPorNombre: a.creadoPor?.nombreUser ?? null,
            conFoto: false,
            desactivado: a.estado === EstadoAlerta.Desactivada,
          });
        }
        break;
      }
      case TipoContenidoReportado.Evento: {
        for (const e of await this.eventoRepository.find({
          where: { id: In(ids) },
        })) {
          resultado.set(e.id, {
            nombre: e.nombre,
            estado: e.desactivado ? 'Desactivado' : 'Activo',
            creadoPorId: e.creadoPor?.id ?? null,
            creadoPorNombre: e.creadoPor?.nombreUser ?? null,
            conFoto: e.conFoto,
            desactivado: e.desactivado,
          });
        }
        break;
      }
    }
    return resultado;
  }

  private async aplicar(
    tipo: TipoContenidoReportado,
    id: number,
    esFoto: boolean,
    desactivar: boolean,
  ): Promise<void> {
    if (esFoto) {
      if (tipo === TipoContenidoReportado.Nodo) {
        const hay =
          !desactivar && (await this.nodoFotoRepository.existsBy({ nodoId: id }));
        await this.nodoRepository.update({ id }, { conFoto: hay });
      } else if (tipo === TipoContenidoReportado.Evento) {
        const hay =
          !desactivar &&
          (await this.eventoFotoRepository.existsBy({ eventoId: id }));
        await this.eventoRepository.update({ id }, { conFoto: hay });
      }
      return;
    }

    switch (tipo) {
      case TipoContenidoReportado.Nodo:
        await this.nodoRepository.update(
          { id },
          { estado: desactivar ? EstadoNodo.Rechazado : EstadoNodo.Aprobado },
        );
        break;
      case TipoContenidoReportado.Ruta:
        await this.rutaRepository.update(
          { id },
          { estado: desactivar ? EstadoRuta.Rechazada : EstadoRuta.Publicada },
        );
        break;
      case TipoContenidoReportado.Alerta:
        await this.alertaRepository.update(
          { id },
          { estado: desactivar ? EstadoAlerta.Desactivada : EstadoAlerta.Activa },
        );
        break;
      case TipoContenidoReportado.Evento:
        await this.eventoRepository.update({ id }, { desactivado: desactivar });
        break;
    }
  }

  async crear(
    dto: CrearReporteContenidoDto,
    actual: UsuarioAutenticado,
  ): Promise<ReporteContenido> {
    const esFoto = dto.esFoto ?? false;
    const contenido = await this.cargarContenido(
      dto.tipoContenido,
      dto.contenidoId,
    );
    if (!contenido) {
      throw new NotFoundException('El contenido denunciado no existe');
    }
    if (contenido.creadoPorId === actual.id) {
      throw new ForbiddenException('No puedes reportar tu propio contenido');
    }
    if (dto.motivo === MotivoReporte.Otro && !dto.descripcion?.trim()) {
      throw new BadRequestException('Cuentanos por que lo reportas');
    }
    if (esFoto) {
      const tieneFotos =
        dto.tipoContenido === TipoContenidoReportado.Nodo ||
        dto.tipoContenido === TipoContenidoReportado.Evento;
      if (!tieneFotos || !contenido.conFoto) {
        throw new BadRequestException('Este contenido no tiene foto que reportar');
      }
    }
    if (
      await this.reporteRepository.existsBy({
        reportadoPor: { id: actual.id },
        tipoContenido: dto.tipoContenido,
        contenidoId: dto.contenidoId,
      })
    ) {
      throw new ConflictException('Ya reportaste este contenido');
    }

    let guardado: ReporteContenido;
    try {
      guardado = await this.reporteRepository.save(
        this.reporteRepository.create({
          tipoContenido: dto.tipoContenido,
          contenidoId: dto.contenidoId,
          motivo: dto.motivo,
          descripcion: dto.descripcion?.trim() || null,
          esFoto,
          resolucion: null,
          reportadoPor: { id: actual.id },
          estado: EstadoReporteContenido.Pendiente,
          resueltoEn: null,
        }),
      );
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya reportaste este contenido');
      }
      throw error;
    }

    this.enviarSinEsperar(
      actual.email,
      'Recibimos tu reporte',
      `Recibimos tu reporte sobre ${this.descripcionCorreo(dto.tipoContenido, esFoto, contenido.nombre)}.\n\n` +
        'Lo revisaremos y te avisaremos por este medio con lo que se decida.\n\n' +
        'Gracias por ayudarnos a cuidar la comunidad de FitQuest Go.',
    );
    return guardado;
  }

  async listar(): Promise<ReporteConContenido[]> {
    const reportes = await this.reporteRepository.find({
      select: { reportadoPor: { id: true, nombreUser: true } },
      relations: { reportadoPor: true },
      order: { creadoEn: 'DESC' },
    });
    return this.conContenido(reportes);
  }

  async obtener(id: number): Promise<ReporteConContenido> {
    const reporte = await this.reporteRepository.findOne({
      where: { id },
      select: { reportadoPor: { id: true, nombreUser: true, emailUser: true } },
      relations: { reportadoPor: true },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }

    return (await this.conContenido([reporte]))[0];
  }

  async resolver(
    id: number,
    accion: AccionResolverReporte,
  ): Promise<ReporteConContenido> {
    const reporte = await this.obtener(id);
    if (reporte.estado !== EstadoReporteContenido.Pendiente) {
      throw new ConflictException('Este reporte ya fue resuelto');
    }

    const desactivar = accion === AccionResolverReporte.Desactivar;
    const contenido = reporte.contenido;
    if (desactivar) {
      if (!contenido) {
        throw new NotFoundException('El contenido denunciado ya no existe');
      }
      await this.aplicar(
        reporte.tipoContenido,
        reporte.contenidoId,
        reporte.esFoto,
        true,
      );
    }

    await this.reporteRepository.update(
      { id },
      {
        estado: desactivar
          ? EstadoReporteContenido.Resuelta
          : EstadoReporteContenido.Archivada,
        resolucion: desactivar
          ? ResolucionReporte.Desactivado
          : ResolucionReporte.Conservado,
        resueltoEn: new Date(),
      },
    );

    const que = this.descripcionCorreo(
      reporte.tipoContenido,
      reporte.esFoto,
      contenido?.nombre ?? 'el contenido reportado',
    );
    this.enviarSinEsperar(
      reporte.reportadoPor.emailUser,
      desactivar ? 'Revisamos tu reporte: se desactivó' : 'Revisamos tu reporte: se conserva',
      desactivar
        ? `Se ha desactivado ${que} porque, tras revisar tu reporte, sí infringe las normas de FitQuest Go.\n\nGracias por ayudarnos a cuidar la comunidad.`
        : `No se ha desactivado ${que} porque, tras revisar tu reporte, no infringe las normas de FitQuest Go.\n\nGracias por ayudarnos a cuidar la comunidad.`,
    );

    return this.obtener(id);
  }

  async reactivar(id: number): Promise<ReporteConContenido> {
    const reporte = await this.obtener(id);
    if (reporte.resolucion !== ResolucionReporte.Desactivado) {
      throw new ConflictException('Este reporte no desactivo nada');
    }
    if (!reporte.contenido) {
      throw new NotFoundException('El contenido denunciado ya no existe');
    }
    await this.aplicar(
      reporte.tipoContenido,
      reporte.contenidoId,
      reporte.esFoto,
      false,
    );
    await this.reporteRepository.update(
      { id },
      {
        estado: EstadoReporteContenido.Archivada,
        resolucion: ResolucionReporte.Conservado,
        resueltoEn: new Date(),
      },
    );
    return this.obtener(id);
  }

  async cambiarEstado(
    id: number,
    estado: EstadoReporteContenido,
  ): Promise<ReporteConContenido> {
    await this.obtener(id);
    await this.reporteRepository.update(
      { id },
      {
        estado,
        resueltoEn:
          estado === EstadoReporteContenido.Pendiente ? null : new Date(),
      },
    );
    return this.obtener(id);
  }

  private async conContenido(
    reportes: ReporteContenido[],
  ): Promise<ReporteConContenido[]> {
    const porTipo = new Map<TipoContenidoReportado, Set<number>>();
    for (const r of reportes) {
      const ids = porTipo.get(r.tipoContenido) ?? new Set<number>();
      ids.add(r.contenidoId);
      porTipo.set(r.tipoContenido, ids);
    }
    const contenidos = new Map<TipoContenidoReportado, Map<number, ContenidoReportado>>();
    for (const [tipo, ids] of porTipo) {
      contenidos.set(tipo, await this.cargarContenidos(tipo, [...ids]));
    }
    return reportes.map((r) => {
      const contenido = contenidos.get(r.tipoContenido)?.get(r.contenidoId) ?? null;
      const visto =
        contenido && r.esFoto
          ? { ...contenido, desactivado: !contenido.conFoto }
          : contenido;
      return Object.assign(r, { contenido: visto });
    });
  }

  private descripcionCorreo(
    tipo: TipoContenidoReportado,
    esFoto: boolean,
    nombre: string,
  ): string {
    const articulo = ARTICULO[tipo];
    return esFoto
      ? `la foto de ${articulo} «${nombre}»`
      : `${articulo} «${nombre}»`;
  }

  private enviarSinEsperar(
    destinatario: string | undefined,
    asunto: string,
    texto: string,
  ): void {
    if (!destinatario) return;
    this.mail.enviar(destinatario, asunto, texto).catch((error: unknown) => {
      this.logger.error(
        `No se pudo enviar el correo "${asunto}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
