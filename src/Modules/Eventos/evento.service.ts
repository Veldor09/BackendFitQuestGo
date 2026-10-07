import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { esAdmin } from '../Auth/es-admin';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { ActualizarEventoDto, CrearEventoDto } from './dto/EventoDTO';
import { Evento, ZonaEvento } from './evento.entity';

/** Deja de cada trazo solo lo que se guarda (sin propiedades de mas). */
const aZonas = (
  trazos: { nombre: string; puntos: { lat: number; lng: number }[] }[],
): ZonaEvento[] =>
  trazos.map((t) => ({
    nombre: t.nombre.trim(),
    puntos: t.puntos.map((p) => ({ lat: p.lat, lng: p.lng })),
  }));

@Injectable()
export class EventoService {
  constructor(
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
  ) {}

  /** Lo que ve el deportista: eventos que no han terminado, el mas proximo primero. */
  findVigentes(): Promise<Evento[]> {
    return this.eventoRepository.find({
      where: { fechaFin: MoreThanOrEqual(new Date()) },
      order: { fechaInicio: 'ASC', id: 'ASC' },
    });
  }

  /** Panel de la empresa: todos los suyos, tambien los que ya terminaron. */
  findMios(usuarioId: number): Promise<Evento[]> {
    return this.eventoRepository.find({
      where: { creadoPor: { id: usuarioId } },
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
    if (dto.areas !== undefined) evento.areas = aZonas(dto.areas);
    if (dto.recorridos !== undefined) {
      evento.recorridos = aZonas(dto.recorridos);
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
