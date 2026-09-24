import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CrearRutaDto } from './dto/RutaDTO';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';

@Injectable()
export class RutaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
    @InjectRepository(RutaFavorita)
    private readonly favoritaRepository: Repository<RutaFavorita>,
  ) {}

  /**
   * Explorar rutas comunitarias (RTE-01).
   */
  findPublicadas(): Promise<Ruta[]> {
    return this.rutaRepository
      .createQueryBuilder('ruta')
      .leftJoin('ruta.creadoPor', 'creadoPor')
      .addSelect(['creadoPor.id', 'creadoPor.nombreUser'])
      .where('ruta.estado = :estado', { estado: EstadoRuta.Publicada })
      .orderBy('ruta.id', 'DESC')
      .getMany();
  }

  /** Mis rutas, todos los estados (RTE-02). */
  findMisRutas(usuarioId: number): Promise<Ruta[]> {
    return this.rutaRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { id: 'DESC' },
    });
  }

  /** Rutas guardadas / favoritas del usuario (RTE-03). */
  async findFavoritas(usuarioId: number): Promise<Ruta[]> {
    const favs = await this.favoritaRepository.find({
      where: { usuarioId },
      order: { guardadoEn: 'DESC' },
    });

    if (favs.length === 0) {
      return [];
    }

    const ids = favs.map((f) => f.rutaId);
    return this.rutaRepository.find({
      where: { id: In(ids) },
    });
  }

  /** Lista de IDs de rutas favoritas para marcar en UI. */
  async findFavoritasIds(usuarioId: number): Promise<number[]> {
    const favs = await this.favoritaRepository.find({
      where: { usuarioId },
      select: ['rutaId'],
    });
    return favs.map((f) => f.rutaId);
  }

  /** Toggle favorita: si existe la elimina, si no existe la agrega. */
  async toggleFavorita(
    rutaId: number,
    usuarioId: number,
  ): Promise<{ favorita: boolean }> {
    const ruta = await this.rutaRepository.findOne({ where: { id: rutaId } });
    if (!ruta) {
      throw new NotFoundException(`Ruta ${rutaId} no encontrada`);
    }

    const existente = await this.favoritaRepository.findOne({
      where: { usuarioId, rutaId },
    });

    if (existente) {
      await this.favoritaRepository.remove(existente);
      return { favorita: false };
    }

    const fav = this.favoritaRepository.create({
      usuarioId,
      rutaId,
    });
    await this.favoritaRepository.save(fav);
    return { favorita: true };
  }

  /** Cola de moderacion (ADM-04). */
  findPendientes(): Promise<Ruta[]> {
    return this.rutaRepository.find({
      where: { estado: EstadoRuta.Pendiente },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Ruta> {
    const ruta = await this.rutaRepository.findOne({ where: { id } });
    if (!ruta) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    return ruta;
  }

  create(dto: CrearRutaDto, usuarioId: number): Promise<Ruta> {
    const visibilidad = dto.visibilidad || 'privada';
    const estado = (visibilidad === 'publica' || visibilidad === 'publico')
      ? EstadoRuta.Pendiente
      : EstadoRuta.Privada;
    const ruta = this.rutaRepository.create({
      ...dto,
      visibilidad,
      estado,
      creadoPor: { id: usuarioId },
    });
    return this.rutaRepository.save(ruta);
  }

  /** Envia una ruta privada a revision (RTE-07/MOD-01). Solo el dueno. */
  async solicitarPublicacion(id: number, usuarioId: number): Promise<Ruta> {
    const ruta = await this.findOne(id);
    if (ruta.creadoPor.id !== usuarioId) {
      throw new ForbiddenException('Esta ruta no te pertenece');
    }
    if (ruta.estado !== EstadoRuta.Privada) {
      throw new ForbiddenException(
        'Solo una ruta privada puede enviarse a revision',
      );
    }
    ruta.estado = EstadoRuta.Pendiente;
    return this.rutaRepository.save(ruta);
  }

  /** Aprobar / rechazar (ADM-05): solo admin. */
  async cambiarEstado(id: number, estado: EstadoRuta): Promise<Ruta> {
    const ruta = await this.findOne(id);
    ruta.estado = estado;
    return this.rutaRepository.save(ruta);
  }
}
