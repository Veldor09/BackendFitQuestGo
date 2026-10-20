import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { esEmpresa } from '../Auth/es-empresa';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { Evento } from '../Eventos/evento.entity';
import { CategoriaNodo } from '../Nodos/categoria-nodo.enum';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { Nodo } from '../Nodos/nodo.entity';
import { RoleId } from '../Usuarios/roles.enum';
import {
  SUSCRIPCIONES_VIGENTES,
  type SuscripcionesVigentes,
} from './suscripciones-vigentes';

/**
 * Por que no se pudo encender un destacado. Viajan como el `message` de un
 * `ForbiddenException`: es lo que la app lee en `ApiException.message`.
 */
export type CodigoDestacar =
  'DESTACAR_SIN_PLAN' | 'DESTACAR_TOPE' | 'DESTACAR_NO_ELEGIBLE';

export interface ResultadoDestacar {
  id: number;
  destacarActivado: boolean;
  destacado: boolean;
}

export type ConDestacado<T> = T & { destacado: boolean };

/** Categorias de punto de interes que un usuario normal puede destacar (spec, seccion 6). */
export const CATEGORIAS_COMERCIO: readonly string[] = [
  CategoriaNodo.Comercio,
  CategoriaNodo.Restaurante,
  CategoriaNodo.Taller,
];

const LIMITE_POR_DEFECTO = 20;

/** Maximo de interruptores encendidos por cuenta; configurable con `DESTACADOS_LIMITE`. */
export function limiteDestacados(): number {
  const configurado = Number(process.env.DESTACADOS_LIMITE);
  return Number.isInteger(configurado) && configurado > 0
    ? configurado
    : LIMITE_POR_DEFECTO;
}

interface NodoDestacable {
  creadoPor: { id: number };
  patrocinado: boolean;
  categoria: string;
  estado: EstadoNodo;
  destacarActivado?: boolean;
}

interface EventoDestacable {
  creadoPor: { id: number };
  fechaFin: Date;
  destacarActivado?: boolean;
}

/** Lo que un punto puede llegar a destacar, segun lo que es (sin saber quien mira). */
const nodoEsDestacable = (nodo: NodoDestacable): boolean =>
  nodo.patrocinado || CATEGORIAS_COMERCIO.includes(nodo.categoria);

/** Ademas de lo anterior, quien lo enciende: la empresa sus locales, el usuario normal sus comercios. */
function actorPuedeDestacarNodo(
  nodo: NodoDestacable,
  actual: UsuarioAutenticado,
): boolean {
  if (nodo.estado !== EstadoNodo.Aprobado) return false;
  if (esEmpresa(actual)) return nodo.patrocinado;
  if (actual.rol === Number(RoleId.UserNormal)) {
    return !nodo.patrocinado && CATEGORIAS_COMERCIO.includes(nodo.categoria);
  }
  return false; // un admin no destaca
}

const eventoTermino = (evento: EventoDestacable, ahora: Date): boolean =>
  evento.fechaFin.getTime() < ahora.getTime();

/**
 * Las reglas de "destacar" (spec 2026-10-19, secciones 6 y 8.2).
 *
 * Un contenido sale destacado cuando su dueno lo tiene encendido, tiene un plan
 * vigente AHORA, el contenido es visible y es elegible. Nada se apaga con un
 * trabajo programado: se calcula al leer, asi el vencimiento es inmediato y el
 * interruptor se conserva para cuando el plan se renueve.
 */
@Injectable()
export class DestacadosService {
  constructor(
    @InjectRepository(Nodo)
    private readonly nodoRepository: Repository<Nodo>,
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
    @Inject(SUSCRIPCIONES_VIGENTES)
    private readonly vigentes: SuscripcionesVigentes,
  ) {}

  /**
   * Enciende o apaga el destacado de un punto del actor. Orden de las reglas:
   * existe, es suyo, y si es para apagar se apaga sin mas; si no, es elegible,
   * y solo si estaba apagado hacen falta plan vigente y cupo.
   */
  async destacarNodo(
    id: number,
    actual: UsuarioAutenticado,
    destacar: boolean,
    ahora: Date = new Date(),
  ): Promise<ResultadoDestacar> {
    const nodo = await this.nodoRepository.findOne({ where: { id } });
    if (!nodo) throw new NotFoundException(`Nodo ${id} no encontrado`);
    if (nodo.creadoPor.id !== actual.id) {
      throw new ForbiddenException('Este nodo no te pertenece');
    }

    if (!destacar) {
      nodo.destacarActivado = false;
      await this.nodoRepository.save(nodo);
      return { id: nodo.id, destacarActivado: false, destacado: false };
    }

    if (!actorPuedeDestacarNodo(nodo, actual)) {
      throw new ForbiddenException(
        'DESTACAR_NO_ELEGIBLE' satisfies CodigoDestacar,
      );
    }
    if (!nodo.destacarActivado) {
      await this.exigirPlanYCupo(actual.id, ahora);
      nodo.destacarActivado = true;
      await this.nodoRepository.save(nodo);
    }
    const [efectivo] = await this.nodosConDestacado([nodo], ahora);
    return {
      id: nodo.id,
      destacarActivado: true,
      destacado: efectivo.destacado,
    };
  }

  /** Lo mismo para un evento: solo lo destaca la empresa duena, y mientras no haya terminado. */
  async destacarEvento(
    id: number,
    actual: UsuarioAutenticado,
    destacar: boolean,
    ahora: Date = new Date(),
  ): Promise<ResultadoDestacar> {
    const evento = await this.eventoRepository.findOne({ where: { id } });
    if (!evento) throw new NotFoundException(`Evento ${id} no encontrado`);
    if (evento.creadoPor.id !== actual.id) {
      throw new ForbiddenException('Este evento no te pertenece');
    }

    if (!destacar) {
      evento.destacarActivado = false;
      await this.eventoRepository.save(evento);
      return { id: evento.id, destacarActivado: false, destacado: false };
    }

    if (!esEmpresa(actual) || eventoTermino(evento, ahora)) {
      throw new ForbiddenException(
        'DESTACAR_NO_ELEGIBLE' satisfies CodigoDestacar,
      );
    }
    if (!evento.destacarActivado) {
      await this.exigirPlanYCupo(actual.id, ahora);
      evento.destacarActivado = true;
      await this.eventoRepository.save(evento);
    }
    const [efectivo] = await this.eventosConDestacado([evento], ahora);
    return {
      id: evento.id,
      destacarActivado: true,
      destacado: efectivo.destacado,
    };
  }

  /**
   * Agrega `destacado` (el efectivo) a cada punto y pone primero los
   * destacados, sin alterar el orden del resto. Trabaja sobre las MISMAS
   * instancias: si se copiaran (`{ ...nodo }`) `@SoloAutorPublico` dejaria de
   * recortar `creadoPor` y la lectura publica filtraria el correo del dueno.
   */
  nodosConDestacado<T extends NodoDestacable>(
    nodos: T[],
    ahora: Date = new Date(),
  ): Promise<ConDestacado<T>[]> {
    return this.conDestacado(
      nodos,
      (nodo) =>
        !!nodo.destacarActivado &&
        nodo.estado === EstadoNodo.Aprobado &&
        nodoEsDestacable(nodo),
      ahora,
    );
  }

  eventosConDestacado<T extends EventoDestacable>(
    eventos: T[],
    ahora: Date = new Date(),
  ): Promise<ConDestacado<T>[]> {
    return this.conDestacado(
      eventos,
      (evento) => !!evento.destacarActivado && !eventoTermino(evento, ahora),
      ahora,
    );
  }

  async nodoConDestacado<T extends NodoDestacable>(
    nodo: T,
    ahora: Date = new Date(),
  ): Promise<ConDestacado<T>> {
    const [conservado] = await this.nodosConDestacado([nodo], ahora);
    return conservado;
  }

  async eventoConDestacado<T extends EventoDestacable>(
    evento: T,
    ahora: Date = new Date(),
  ): Promise<ConDestacado<T>> {
    const [conservado] = await this.eventosConDestacado([evento], ahora);
    return conservado;
  }

  /**
   * `candidato` dice si el contenido cumple todo menos el plan; la vigencia se
   * consulta una sola vez para los duenos de los candidatos (lo habitual es que
   * ninguno lo sea y no haga falta tocar la base).
   */
  private async conDestacado<T extends { creadoPor: { id: number } }>(
    elementos: T[],
    candidato: (elemento: T) => boolean,
    ahora: Date,
  ): Promise<ConDestacado<T>[]> {
    const duenos = [
      ...new Set(
        elementos.filter(candidato).map((elemento) => elemento.creadoPor.id),
      ),
    ];
    const conPlan =
      duenos.length === 0
        ? new Set<number>()
        : await this.vigentes.conVigencia(duenos, ahora);

    const resultado = elementos.map((elemento) =>
      Object.assign(elemento, {
        destacado: candidato(elemento) && conPlan.has(elemento.creadoPor.id),
      }),
    );
    return [
      ...resultado.filter((elemento) => elemento.destacado),
      ...resultado.filter((elemento) => !elemento.destacado),
    ];
  }

  /** Para encender hace falta un plan vigente y no haber llegado al tope (que solo cuenta lo visible). */
  private async exigirPlanYCupo(usuarioId: number, ahora: Date): Promise<void> {
    const conPlan = await this.vigentes.conVigencia([usuarioId], ahora);
    if (!conPlan.has(usuarioId)) {
      throw new ForbiddenException(
        'DESTACAR_SIN_PLAN' satisfies CodigoDestacar,
      );
    }

    const [puntos, eventos] = await Promise.all([
      this.nodoRepository.count({
        where: {
          creadoPor: { id: usuarioId },
          destacarActivado: true,
          estado: EstadoNodo.Aprobado,
        },
      }),
      this.eventoRepository.count({
        where: {
          creadoPor: { id: usuarioId },
          destacarActivado: true,
          fechaFin: MoreThanOrEqual(ahora),
        },
      }),
    ]);
    if (puntos + eventos >= limiteDestacados()) {
      throw new ForbiddenException('DESTACAR_TOPE' satisfies CodigoDestacar);
    }
  }
}
