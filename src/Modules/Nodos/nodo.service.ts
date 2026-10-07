import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsigniasService } from '../Insignias/insignias.service';
import { CrearNodoDto } from './dto/NodoDTO';
import { EstadoNodo } from './estado-nodo.enum';
import { Nodo } from './nodo.entity';

@Injectable()
export class NodoService {
  private readonly logger = new Logger(NodoService.name);

  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,
    private readonly insigniasService: InsigniasService,
  ) {}

  /**
   * Nodos visibles en el mapa: solo los aprobados. `creadoPor` es eager y
   * `select` no recorta columnas de relaciones eager de forma confiable, asi
   * que se arma con QueryBuilder para no exponer el correo de quien lo
   * propuso a cualquiera que mire el mapa.
   */
  findAprobados(): Promise<Nodo[]> {
    return this.nodoRepository
      .createQueryBuilder('nodo')
      .leftJoin('nodo.creadoPor', 'creadoPor')
      .addSelect(['creadoPor.id', 'creadoPor.nombreUser'])
      .where('nodo.estado = :estado', { estado: EstadoNodo.Aprobado })
      .orderBy('nodo.id', 'DESC')
      .getMany();
  }

  /** Cola de moderacion (ADM-07). */
  findPendientes(): Promise<Nodo[]> {
    return this.nodoRepository.find({
      where: { estado: EstadoNodo.Pendiente },
      order: { id: 'ASC' },
    });
  }

  findMisNodos(usuarioId: number): Promise<Nodo[]> {
    return this.nodoRepository.find({
      where: { creadoPor: { id: usuarioId } },
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Nodo> {
    const nodo = await this.nodoRepository.findOne({ where: { id } });
    if (!nodo) {
      throw new NotFoundException(`Nodo ${id} no encontrado`);
    }
    return nodo;
  }

  async create(dto: CrearNodoDto, usuarioId: number): Promise<Nodo> {
    const nodo = this.nodoRepository.create({
      ...dto,
      estado: EstadoNodo.Pendiente,
      creadoPor: { id: usuarioId },
    });
    const guardado = await this.nodoRepository.save(nodo);

    // Evaluar insignia PRIMER_PUNTO_INTERES
    try {
      await this.insigniasService.evaluar(usuarioId);
    } catch (error) {
      this.logger.error(
        `Error al evaluar insignias tras crear nodo para usuario ${usuarioId}: ${error.message}`,
      );
    }

    return guardado;
  }

  async cambiarEstado(id: number, estado: EstadoNodo): Promise<Nodo> {
    const nodo = await this.findOne(id);
    nodo.estado = estado;
    return this.nodoRepository.save(nodo);
  }
}
