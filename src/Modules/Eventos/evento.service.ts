import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { esAdmin } from '../Auth/es-admin';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import {
  detectarTipoImagen,
  MAX_FOTO_BYTES,
} from '../Nodos/imagen.util';
import { ActualizarEventoDto, CrearEventoDto } from './dto/EventoDTO';
import { EventoFoto } from './evento-foto.entity';
import { Evento, ZonaEvento } from './evento.entity';
import { MailService } from '../Auth/services/mail.service';

/** Deja de cada trazo solo lo que se guarda (sin propiedades de mas). */
const aZonas = (
  trazos: { nombre: string; puntos: { lat: number; lng: number }[] }[],
): ZonaEvento[] =>
  trazos.map((t) => ({
    nombre: t.nombre.trim(),
    puntos: t.puntos.map((p) => ({ lat: p.lat, lng: p.lng })),
    estado: 'Pendiente',
  }));

const conservarZonas = (
  nuevas: ZonaEvento[], anteriores: ZonaEvento[],
): ZonaEvento[] => nuevas.map((zona) => {
  const previa = anteriores.find((otra) => otra.nombre === zona.nombre &&
    JSON.stringify(otra.puntos) === JSON.stringify(zona.puntos));
  return previa ? { ...zona, estado: previa.estado ?? 'Aprobado' } : zona;
});

@Injectable()
export class EventoService {
  private readonly logger = new Logger(EventoService.name);
  constructor(
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
    @Optional()
    @InjectRepository(EventoFoto)
    private readonly fotoRepository?: Repository<EventoFoto>,
    @Optional() private readonly mail?: MailService,
  ) {}

  /** Lo que ve el deportista: eventos que no han terminado, el mas proximo primero. */
  async findVigentes(): Promise<Evento[]> {
    const eventos = await this.eventoRepository.find({
      where: { fechaFin: MoreThanOrEqual(new Date()), desactivado: false },
      order: { fechaInicio: 'ASC', id: 'ASC' },
    });
    return eventos.map((evento) => {
      evento.areas = evento.areas.filter((zona) => !zona.estado || zona.estado === 'Aprobado');
      evento.recorridos = evento.recorridos.filter((zona) => !zona.estado || zona.estado === 'Aprobado');
      return evento;
    }).filter((evento) => evento.areas.length > 0 || evento.recorridos.length > 0);
  }

  async decidirZona(id: number, tipo: 'areas' | 'recorridos', indice: number,
    estado: 'Aprobado' | 'Denegado'): Promise<Evento> {
    const evento = await this.findOne(id);
    const zona = evento[tipo][indice];
    if (!zona) throw new NotFoundException('Trazo no encontrado');
    if (zona.estado !== 'Pendiente') {
      throw new BadRequestException('Este trazo ya fue revisado');
    }
    zona.estado = estado;
    const guardado = await this.eventoRepository.save(evento);
    if (this.mail && evento.creadoPor?.emailUser) {
      const clase = tipo === 'areas' ? 'área' : 'recorrido';
      const decision = estado === 'Aprobado' ? 'aprobado' : 'denegado';
      await this.mail.enviar(evento.creadoPor.emailUser,
        `Tu ${clase} fue ${decision}`,
        `El ${clase} "${zona.nombre}" fue ${decision}. ` +
        (estado === 'Aprobado' ? 'Ya está visible en FitQuest Go.' : 'No se publicará en FitQuest Go.'))
        .catch((error: unknown) => this.logger.error('No se pudo enviar la decisión por correo', error));
    }
    return guardado;
  }

  /** Panel de la empresa: todos los suyos, tambien los que ya terminaron. */
  findMios(usuarioId: number): Promise<Evento[]> {
    return this.eventoRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { fechaInicio: 'DESC', id: 'DESC' },
    });
  }

  /**
   * ADM-08: listado administrativo de todos los eventos.
   * Incluye eventos futuros, en curso y finalizados.
   *
   * La autorizacion de administrador se valida en el controlador.
   */
  findTodosAdmin(): Promise<Evento[]> {
    return this.eventoRepository.find({
      order: { fechaInicio: 'DESC', id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Evento> {
    const evento = await this.eventoRepository.findOne({ where: { id } });
    if (!evento) {
      throw new NotFoundException(`Evento ${id} no encontrado`);
    }
    return evento;
  }

  async findOnePublico(id: number): Promise<Evento> {
    const evento = await this.findOne(id);
    if (evento.desactivado) throw new NotFoundException(`Evento ${id} no encontrado`);
    evento.areas = evento.areas.filter((zona) => !zona.estado || zona.estado === 'Aprobado');
    evento.recorridos = evento.recorridos.filter((zona) => !zona.estado || zona.estado === 'Aprobado');
    if (evento.areas.length === 0 && evento.recorridos.length === 0)
      throw new NotFoundException(`Evento ${id} no encontrado`);
    return evento;
  }

  async create(dto: CrearEventoDto, usuarioId: number): Promise<Evento> {
    this.validarFechas(dto.fechaInicio, dto.fechaFin);
    if (dto.fechaFin.getTime() <= Date.now()) {
      throw new BadRequestException('El evento no puede terminar en el pasado');
    }
    const areas = aZonas(dto.areas ?? []);
    const recorridos = aZonas(dto.recorridos ?? []);
    this.validarHayTrazo(areas, recorridos);

    return await this.eventoRepository.save(
      this.eventoRepository.create({
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        categoria: dto.categoria,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        areas,
        recorridos,
        creadoPor: { id: usuarioId },
      }),
    );
  }

  /** Solo la empresa que lo creo. Lo que no se envia queda como estaba. */
  async actualizar(
    id: number,
    dto: ActualizarEventoDto,
    actual: UsuarioAutenticado,
  ): Promise<Evento> {
    const evento = await this.findOne(id);
    if (evento.creadoPor.id !== actual.id) {
      throw new ForbiddenException('Este evento no te pertenece');
    }

    if (dto.nombre !== undefined) evento.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) {
      evento.descripcion = dto.descripcion.trim() || null;
    }
    if (dto.categoria !== undefined) evento.categoria = dto.categoria;
    if (dto.fechaInicio !== undefined) evento.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin !== undefined) evento.fechaFin = dto.fechaFin;
    if (dto.areas !== undefined) evento.areas = conservarZonas(aZonas(dto.areas), evento.areas);
    if (dto.recorridos !== undefined) {
      evento.recorridos = conservarZonas(aZonas(dto.recorridos), evento.recorridos);
    }

    this.validarFechas(evento.fechaInicio, evento.fechaFin);
    this.validarHayTrazo(evento.areas, evento.recorridos);
    return this.eventoRepository.save(evento);
  }

  /** Su empresa o un admin (moderacion): no hay aprobacion previa, pero si baja. */
  async eliminar(id: number, actual: UsuarioAutenticado): Promise<void> {
    const evento = await this.findOne(id);
    if (evento.creadoPor.id !== actual.id && !esAdmin(actual)) {
      throw new ForbiddenException('Este evento no te pertenece');
    }
    await this.eventoRepository.remove(evento);
  }

  async guardarFoto(
    id: number,
    datos: Buffer,
    actual: UsuarioAutenticado,
  ): Promise<Evento> {
    const objeto = await this.findOne(id);

    if (objeto.creadoPor.id !== actual.id) {
      throw new ForbiddenException('Este evento no te pertenece');
    }

    if (datos.length > MAX_FOTO_BYTES) {
      throw new PayloadTooLargeException(
        `La foto pesa mas de ${MAX_FOTO_BYTES / (1024 * 1024)} MB`,
      );
    }

    const tipoMime = detectarTipoImagen(datos);
    if (!tipoMime) {
      throw new BadRequestException('La foto debe ser JPEG, PNG o WebP');
    }

    const repo = this.fotoRepository;
    if (!repo) throw new Error('fotoRepository no disponible');
    await repo.save({ eventoId: id, contenido: datos, tipoMime });
    objeto.conFoto = true;
    return this.eventoRepository.save(objeto);
  }

  async obtenerFoto(
    id: number,
    actual?: UsuarioAutenticado,
  ): Promise<{ contenido: Buffer; tipoMime: string }> {
    const evento = await this.findOne(id);
    const visible = evento.conFoto || (actual !== undefined && esAdmin(actual));
    const foto = visible
      ? await this.fotoRepository?.findOne({ where: { eventoId: id } })
      : null;
    if (!foto) {
      throw new NotFoundException(`El evento ${id} no tiene foto`);
    }
    return { contenido: foto.contenido, tipoMime: foto.tipoMime };
  }

  private validarFechas(inicio: Date, fin: Date): void {
    if (fin.getTime() <= inicio.getTime()) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la de inicio',
      );
    }
  }

  private validarHayTrazo(areas: ZonaEvento[], recorridos: ZonaEvento[]): void {
    if (areas.length === 0 && recorridos.length === 0) {
      throw new BadRequestException(
        'Dibuja al menos un area o un recorrido para el evento',
      );
    }
  }
}
