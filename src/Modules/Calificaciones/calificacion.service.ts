import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { distanciaMetros } from '../../common/distancia.util';
import { esViolacionDeUnicidad } from '../../common/postgres';
import { RADIO_VOTO_METROS } from '../../common/votacion';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { Evento, ZonaEvento } from '../Eventos/evento.entity';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { Nodo } from '../Nodos/nodo.entity';
import { RecorridoRuta } from '../Rutas/recorrido-ruta.entity';
import { Ruta } from '../Rutas/ruta.entity';
import {
  RETIRAR_CALIFICACION,
  TipoCalificable,
  ValorCalificacion,
} from './calificacion.enum';
import { Calificacion } from './calificacion.entity';
import { CalificarDto } from './dto/CalificacionDTO';

/** Por que quien consulta no puede calificar (la app lo traduce). */
export type MotivoSinCalificar = 'sin_recorrido' | 'propio' | 'no_disponible';

export interface ResumenCalificacion {
  arriba: number;
  abajo: number;
  mia: ValorCalificacion | null;
  puedeCalificar: boolean;
  motivo: MotivoSinCalificar | null;
}

export interface ResumenArea extends ResumenCalificacion {
  /** Posicion del area en `Evento.areas`. */
  indice: number;
}

export type ResumenEvento = ResumenCalificacion & { areas: ResumenArea[] };

/** Huella corta del trazo de un area: la identifica mientras no se redibuje. */
export const claveDeArea = (zona: ZonaEvento): string =>
  createHash('sha1')
    .update(JSON.stringify(zona.puntos))
    .digest('hex')
    .slice(0, 16);

const SIN_CLAVE = '';

interface Conteo {
  arriba: number;
  abajo: number;
  mia: ValorCalificacion | null;
}

const VACIO: Conteo = { arriba: 0, abajo: 0, mia: null };

@Injectable()
export class CalificacionService {
  constructor(
    @InjectRepository(Calificacion)
    private readonly calificaciones: Repository<Calificacion>,
    @InjectRepository(RecorridoRuta)
    private readonly recorridos: Repository<RecorridoRuta>,
    @InjectRepository(Ruta)
    private readonly rutas: Repository<Ruta>,
    @InjectRepository(Nodo)
    private readonly nodos: Repository<Nodo>,
    @InjectRepository(Evento)
    private readonly eventos: Repository<Evento>,
  ) {}

  /** Conteo y estado de quien consulta sobre una ruta, un nodo o un evento. */
  resumen(
    tipo: TipoCalificable,
    id: number,
    actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion | ResumenEvento> {
    switch (tipo) {
      case TipoCalificable.Ruta:
        return this.resumenRuta(id, actual);
      case TipoCalificable.Nodo:
        return this.resumenNodo(id, actual);
      case TipoCalificable.Evento:
        return this.resumenEvento(id, actual);
    }
  }

  /**
   * Pone, cambia o retira la calificacion de quien consulta y devuelve el
   * resumen ya actualizado. Reglas:
   * - Ruta: solo si registraste un recorrido de ella (iniciar y finalizar).
   * - Nodo: aprobado, no propio y a `RADIO_VOTO_METROS` o menos.
   * - Evento (o un area suya): no propio.
   */
  async calificar(
    tipo: TipoCalificable,
    id: number,
    dto: CalificarDto,
    actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion | ResumenEvento> {
    const clave = await this.validarYClave(tipo, id, dto, actual);

    if (dto.valor === RETIRAR_CALIFICACION) {
      await this.calificaciones.delete({
        tipo,
        objetoId: id,
        clave,
        usuarioId: actual.id,
      });
    } else {
      await this.guardar(tipo, id, clave, actual.id, dto.valor);
    }
    return this.resumen(tipo, id, actual);
  }

  private async validarYClave(
    tipo: TipoCalificable,
    id: number,
    dto: CalificarDto,
    actual: UsuarioAutenticado,
  ): Promise<string> {
    switch (tipo) {
      case TipoCalificable.Ruta: {
        if (!(await this.rutas.existsBy({ id }))) {
          throw new NotFoundException(`Ruta ${id} no encontrada`);
        }
        if (!(await this.hizoRecorrido(id, actual.id))) {
          throw new ForbiddenException(
            'Inicia y finaliza la ruta para poder calificarla',
          );
        }
        return SIN_CLAVE;
      }
      case TipoCalificable.Nodo: {
        const nodo = await this.buscarNodo(id);
        if (nodo.estado !== EstadoNodo.Aprobado) {
          throw new ForbiddenException('Este punto ya no esta disponible');
        }
        if (nodo.creadoPor.id === actual.id) {
          throw new ForbiddenException('No puedes calificar tu propio punto');
        }
        if (dto.lat === undefined || dto.lng === undefined) {
          throw new BadRequestException(
            'Falta tu posicion para calificar el punto',
          );
        }
        const distancia = distanciaMetros(
          dto.lat,
          dto.lng,
          nodo.lat,
          nodo.lng,
        );
        if (distancia > RADIO_VOTO_METROS) {
          throw new BadRequestException(
            `Estas a ${Math.round(distancia)} m del punto: acercate a menos de ${RADIO_VOTO_METROS} m para calificarlo`,
          );
        }
        return SIN_CLAVE;
      }
      case TipoCalificable.Evento: {
        const evento = await this.buscarEvento(id);
        if (evento.creadoPor.id === actual.id) {
          throw new ForbiddenException('No puedes calificar tu propio evento');
        }
        if (dto.area === undefined) return SIN_CLAVE;
        const zona = evento.areas[dto.area];
        if (!zona) {
          throw new BadRequestException(
            `El evento no tiene el area ${dto.area}`,
          );
        }
        return claveDeArea(zona);
      }
    }
  }

  private async guardar(
    tipo: TipoCalificable,
    objetoId: number,
    clave: string,
    usuarioId: number,
    valor: ValorCalificacion,
  ): Promise<void> {
    const donde = { tipo, objetoId, clave, usuarioId };
    const { affected } = await this.calificaciones.update(donde, { valor });
    if (affected) return;
    try {
      await this.calificaciones.save(
        this.calificaciones.create({ ...donde, valor }),
      );
    } catch (error) {
      // Dos toques casi a la vez: el segundo ya no inserta, cambia el valor.
      if (!esViolacionDeUnicidad(error)) throw error;
      await this.calificaciones.update(donde, { valor });
    }
  }

  private async resumenRuta(
    id: number,
    actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion> {
    if (!(await this.rutas.existsBy({ id }))) {
      throw new NotFoundException(`Ruta ${id} no encontrada`);
    }
    const conteos = await this.contar(TipoCalificable.Ruta, id, actual.id);
    const hizo = await this.hizoRecorrido(id, actual.id);
    return {
      ...(conteos.get(SIN_CLAVE) ?? VACIO),
      puedeCalificar: hizo,
      motivo: hizo ? null : 'sin_recorrido',
    };
  }

  private async resumenNodo(
    id: number,
    actual: UsuarioAutenticado,
  ): Promise<ResumenCalificacion> {
    const nodo = await this.buscarNodo(id);
    const conteos = await this.contar(TipoCalificable.Nodo, id, actual.id);
    const propio = nodo.creadoPor.id === actual.id;
    const disponible = nodo.estado === EstadoNodo.Aprobado;
    return {
      ...(conteos.get(SIN_CLAVE) ?? VACIO),
      puedeCalificar: !propio && disponible,
      motivo: propio ? 'propio' : disponible ? null : 'no_disponible',
    };
  }

  private async resumenEvento(
    id: number,
    actual: UsuarioAutenticado,
  ): Promise<ResumenEvento> {
    const evento = await this.buscarEvento(id);
    const conteos = await this.contar(TipoCalificable.Evento, id, actual.id);
    const propio = evento.creadoPor.id === actual.id;
    const estado = {
      puedeCalificar: !propio,
      motivo: propio ? ('propio' as const) : null,
    };
    return {
      ...(conteos.get(SIN_CLAVE) ?? VACIO),
      ...estado,
      areas: evento.areas.map((zona, indice) => ({
        indice,
        ...(conteos.get(claveDeArea(zona)) ?? VACIO),
        ...estado,
      })),
    };
  }

  /** Conteo por clave (vacia para el objeto en si) y la calificacion de `usuarioId`. */
  private async contar(
    tipo: TipoCalificable,
    objetoId: number,
    usuarioId: number,
  ): Promise<Map<string, Conteo>> {
    const filas = await this.calificaciones
      .createQueryBuilder('c')
      .select('c.clave', 'clave')
      .addSelect('c.valor', 'valor')
      .addSelect('COUNT(*)', 'total')
      .where('c.tipo = :tipo AND c.objeto_id = :objetoId', { tipo, objetoId })
      .groupBy('c.clave')
      .addGroupBy('c.valor')
      .getRawMany<{ clave: string; valor: ValorCalificacion; total: string }>();
    const propias = await this.calificaciones.find({
      where: { tipo, objetoId, usuarioId },
    });

    const conteos = new Map<string, Conteo>();
    const de = (clave: string): Conteo => {
      let conteo = conteos.get(clave);
      if (!conteo) {
        conteo = { arriba: 0, abajo: 0, mia: null };
        conteos.set(clave, conteo);
      }
      return conteo;
    };
    for (const fila of filas) {
      const total = Number(fila.total);
      if (fila.valor === ValorCalificacion.Arriba) de(fila.clave).arriba = total;
      else de(fila.clave).abajo = total;
    }
    for (const propia of propias) de(propia.clave).mia = propia.valor;
    return conteos;
  }

  private hizoRecorrido(rutaId: number, usuarioId: number): Promise<boolean> {
    return this.recorridos.existsBy({ rutaId, usuarioId });
  }

  private async buscarNodo(id: number): Promise<Nodo> {
    const nodo = await this.nodos.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException(`Nodo ${id} no encontrado`);
    return nodo;
  }

  private async buscarEvento(id: number): Promise<Evento> {
    const evento = await this.eventos.findOne({ where: { id } });
    if (!evento) throw new NotFoundException(`Evento ${id} no encontrado`);
    return evento;
  }
}
