import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { esAdmin } from '../Auth/es-admin';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { CrearRutaDto } from './dto/RutaDTO';
import { EstadoRuta } from './estado-ruta.enum';
import { Ruta } from './ruta.entity';

@Injectable()
export class RutaService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
  ) {}

  /**
   * Explorar rutas comunitarias (RTE-01). `creadoPor` es eager y `select` no
   * recorta columnas de relaciones eager de forma confiable, asi que se arma
   * con QueryBuilder: no hace falta exponer el correo del autor aqui.
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

  /**
   * Una ruta por su id. Una publicada la ve cualquiera; una privada, pendiente
   * o rechazada solo quien la creo y el admin (que la revisa): su trazo puede
   * mostrar de donde sale y adonde llega alguien. Para el resto responde 404,
   * igual que si no existiera.
   */
  async verRuta(id: number, actual: UsuarioAutenticado): Promise<Ruta> {
    const ruta = await this.findOne(id);
    const puedeVer =
      ruta.estado === EstadoRuta.Publicada ||
      ruta.creadoPor.id === actual.id ||
      esAdmin(actual);
    if (!puedeVer) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    return ruta;
  }

  create(dto: CrearRutaDto, usuarioId: number): Promise<Ruta> {
    const ruta = this.rutaRepository.create({
      ...dto,
      estado: EstadoRuta.Privada,
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
