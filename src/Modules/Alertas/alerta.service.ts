import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CrearAlertaDto } from './dto/AlertaDTO';
import { Alerta } from './alerta.entity';
import {
  EstadoAlerta,
  TTL_HORAS_POR_GRAVEDAD,
  UMBRAL_DESMENTIDOS,
} from './estado-alerta.enum';

@Injectable()
export class AlertaService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepository: Repository<Alerta>,
  ) {}

  /**
   * Alertas vigentes: para el mapa (HOM-01) y para la supervision del admin
   * (ADM-06) por igual. A diferencia de Nodos, una alerta no pasa por cola de
   * aprobacion: se publica de inmediato (ALR-03) por ser de seguridad.
   */
  findActivas(): Promise<Alerta[]> {
    return this.alertaRepository.find({
      where: { estado: EstadoAlerta.Activa, expiraEn: MoreThan(new Date()) },
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Alerta> {
    const alerta = await this.alertaRepository.findOne({ where: { id } });
    if (!alerta) {
      throw new NotFoundException(`Alerta ${id} no encontrada`);
    }
    return alerta;
  }

  create(dto: CrearAlertaDto, usuarioId: number): Promise<Alerta> {
    const horas = TTL_HORAS_POR_GRAVEDAD[dto.gravedad];
    const expiraEn = new Date(Date.now() + horas * 60 * 60 * 1000);
    const alerta = this.alertaRepository.create({
      ...dto,
      estado: EstadoAlerta.Activa,
      confirmacionesNo: 0,
      creadoPor: { id: usuarioId },
      expiraEn,
    });
    return this.alertaRepository.save(alerta);
  }

  /** ALR-04 "Confirmar": alguien la ve vigente, se reinicia el contador de dudas. */
  async confirmar(id: number): Promise<Alerta> {
    const alerta = await this.findOne(id);
    alerta.confirmacionesNo = 0;
    return this.alertaRepository.save(alerta);
  }

  /**
   * ALR-04/05 "Ya no esta": suma una duda; al llegar al umbral se resuelve
   * sola, sin intervencion de un admin.
   */
  async desmentir(id: number): Promise<Alerta> {
    const alerta = await this.findOne(id);
    alerta.confirmacionesNo += 1;
    if (alerta.confirmacionesNo >= UMBRAL_DESMENTIDOS) {
      alerta.estado = EstadoAlerta.Resuelta;
    }
    return this.alertaRepository.save(alerta);
  }

  /** ADM-06 "Marcar resuelta": accion manual del admin. */
  async cambiarEstado(id: number, estado: EstadoAlerta): Promise<Alerta> {
    const alerta = await this.findOne(id);
    alerta.estado = estado;
    return this.alertaRepository.save(alerta);
  }

  /** ADM-06 "Eliminar". */
  async eliminar(id: number): Promise<void> {
    const alerta = await this.findOne(id);
    await this.alertaRepository.remove(alerta);
  }
}
