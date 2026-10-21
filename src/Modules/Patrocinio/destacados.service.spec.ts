import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { MoreThanOrEqual, Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { Evento } from '../Eventos/evento.entity';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { Nodo } from '../Nodos/nodo.entity';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import { DestacadosService, limiteDestacados } from './destacados.service';

const AHORA = new Date('2026-10-20T12:00:00Z');

const usuario: UsuarioAutenticado = {
  id: 7,
  email: 'ana@example.com',
  rol: RoleId.UserNormal,
};
const empresa: UsuarioAutenticado = {
  id: 8,
  email: 'bici@example.com',
  rol: RoleId.Empresa,
};
const admin: UsuarioAutenticado = {
  id: 1,
  email: 'admin@example.com',
  rol: RoleId.Admin,
};

const dueno = (id: number, nombreUser = 'Dueno'): User =>
  Object.assign(new User(), {
    id,
    nombreUser,
    emailUser: `usuario${id}@example.com`,
  });

const nodo = (extra: Partial<Nodo> = {}): Nodo =>
  Object.assign(new Nodo(), {
    id: 5,
    nombre: 'Soda La Esquina',
    categoria: 'comercio',
    patrocinado: false,
    estado: EstadoNodo.Aprobado,
    destacarActivado: false,
    creadoPor: dueno(7),
    ...extra,
  });

const evento = (extra: Partial<Evento> = {}): Evento =>
  Object.assign(new Evento(), {
    id: 11,
    nombre: 'Carrera del Valle',
    fechaInicio: new Date('2026-10-25T12:00:00Z'),
    fechaFin: new Date('2026-10-26T12:00:00Z'),
    destacarActivado: false,
    creadoPor: dueno(8),
    ...extra,
  });

interface RepoFalso {
  findOne: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
}

const repoFalso = (): RepoFalso => ({
  findOne: jest.fn(),
  save: jest.fn((entidad: unknown) => Promise.resolve(entidad)),
  count: jest.fn().mockResolvedValue(0),
});

/** El error con el que termina una promesa (o undefined si no fallo). */
async function falla(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  return undefined;
}

function esperarProhibido(error: unknown, mensaje: string): void {
  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).message).toBe(mensaje);
}

describe('DestacadosService — las reglas de destacar', () => {
  let nodos: RepoFalso;
  let eventos: RepoFalso;
  let conPlan: Set<number>;
  let vigentes: { conVigencia: jest.Mock; vencenEntre: jest.Mock };
  let servicio: DestacadosService;

  beforeEach(() => {
    delete process.env.DESTACADOS_LIMITE;
    conPlan = new Set<number>([7, 8]);
    nodos = repoFalso();
    eventos = repoFalso();
    vigentes = {
      conVigencia: jest.fn((ids: number[]) =>
        Promise.resolve(new Set(ids.filter((id) => conPlan.has(id)))),
      ),
      vencenEntre: jest.fn(),
    };
    servicio = new DestacadosService(
      nodos as unknown as Repository<Nodo>,
      eventos as unknown as Repository<Evento>,
      vigentes,
    );
  });

  afterEach(() => {
    delete process.env.DESTACADOS_LIMITE;
  });

  describe('destacarNodo — encender', () => {
    it.each(['comercio', 'restaurante', 'taller'])(
      'un usuario normal con plan enciende su punto de categoria %s',
      async (categoria) => {
        nodos.findOne.mockResolvedValue(nodo({ categoria }));

        await expect(
          servicio.destacarNodo(5, usuario, true, AHORA),
        ).resolves.toEqual({ id: 5, destacarActivado: true, destacado: true });
        expect(nodos.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 5, destacarActivado: true }),
        );
      },
    );

    it('una empresa con plan enciende su local, de la categoria que sea', async () => {
      nodos.findOne.mockResolvedValue(
        nodo({ patrocinado: true, categoria: 'agua', creadoPor: dueno(8) }),
      );

      await expect(
        servicio.destacarNodo(5, empresa, true, AHORA),
      ).resolves.toEqual({ id: 5, destacarActivado: true, destacado: true });
      expect(nodos.save).toHaveBeenCalledWith(
        expect.objectContaining({ destacarActivado: true }),
      );
    });

    const noElegibles: Array<[string, UsuarioAutenticado, Partial<Nodo>]> = [
      [
        'un usuario normal con una categoria que no es de comercio',
        usuario,
        { categoria: 'agua' },
      ],
      [
        'una empresa con un punto que no es un local suyo (no patrocinado)',
        empresa,
        { creadoPor: dueno(8) },
      ],
      [
        'un usuario normal con un punto patrocinado',
        usuario,
        { patrocinado: true },
      ],
      ['un admin, que no destaca', admin, { creadoPor: dueno(1) }],
      ['un punto rechazado', usuario, { estado: EstadoNodo.Rechazado }],
      [
        'un punto retirado por la comunidad (obsoleto)',
        usuario,
        { estado: EstadoNodo.Obsoleto },
      ],
    ];
    it.each(noElegibles)('no se enciende: %s', async (_caso, actor, extra) => {
      nodos.findOne.mockResolvedValue(nodo(extra));

      esperarProhibido(
        await falla(servicio.destacarNodo(5, actor, true, AHORA)),
        'DESTACAR_NO_ELEGIBLE',
      );
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('un punto de otro dueno no se toca', async () => {
      nodos.findOne.mockResolvedValue(nodo({ creadoPor: dueno(99) }));

      esperarProhibido(
        await falla(servicio.destacarNodo(5, usuario, true, AHORA)),
        'Este nodo no te pertenece',
      );
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('un punto que no existe es un 404', async () => {
      nodos.findOne.mockResolvedValue(null);

      const error = await falla(
        servicio.destacarNodo(99, usuario, true, AHORA),
      );

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        'Nodo 99 no encontrado',
      );
    });

    it('sin plan vigente no se enciende', async () => {
      conPlan.clear();
      nodos.findOne.mockResolvedValue(nodo());

      esperarProhibido(
        await falla(servicio.destacarNodo(5, usuario, true, AHORA)),
        'DESTACAR_SIN_PLAN',
      );
      expect(nodos.save).not.toHaveBeenCalled();
    });
  });

  describe('el tope de interruptores encendidos por cuenta', () => {
    beforeEach(() => {
      nodos.findOne.mockResolvedValue(nodo());
    });

    it('con 20 ya encendidos (puntos y eventos juntos) no deja encender otro', async () => {
      nodos.count.mockResolvedValue(12);
      eventos.count.mockResolvedValue(8);

      esperarProhibido(
        await falla(servicio.destacarNodo(5, usuario, true, AHORA)),
        'DESTACAR_TOPE',
      );
      expect(nodos.save).not.toHaveBeenCalled();
    });

    it('con 19 todavia deja', async () => {
      nodos.count.mockResolvedValue(19);

      await expect(
        servicio.destacarNodo(5, usuario, true, AHORA),
      ).resolves.toMatchObject({ destacarActivado: true });
    });

    it('el tope se configura con DESTACADOS_LIMITE', async () => {
      process.env.DESTACADOS_LIMITE = '2';
      nodos.count.mockResolvedValue(1);
      eventos.count.mockResolvedValue(1);

      esperarProhibido(
        await falla(servicio.destacarNodo(5, usuario, true, AHORA)),
        'DESTACAR_TOPE',
      );
    });

    it('solo cuenta lo que sigue visible: puntos aprobados y eventos que no terminaron', async () => {
      // Review Focus 2: un evento terminado ya no muestra su interruptor en la
      // app, asi que si ocupara cupo la cuenta quedaria bloqueada para siempre.
      await servicio.destacarNodo(5, usuario, true, AHORA);

      expect(nodos.count).toHaveBeenCalledWith({
        where: {
          creadoPor: { id: 7 },
          destacarActivado: true,
          estado: EstadoNodo.Aprobado,
        },
      });
      expect(eventos.count).toHaveBeenCalledWith({
        where: {
          creadoPor: { id: 7 },
          destacarActivado: true,
          fechaFin: MoreThanOrEqual(AHORA),
        },
      });
    });
  });

  describe('destacarNodo — apagar siempre se puede', () => {
    it('apaga aunque no haya plan ni cupo', async () => {
      conPlan.clear();
      nodos.count.mockResolvedValue(50);
      eventos.count.mockResolvedValue(50);
      nodos.findOne.mockResolvedValue(nodo({ destacarActivado: true }));

      await expect(
        servicio.destacarNodo(5, usuario, false, AHORA),
      ).resolves.toEqual({ id: 5, destacarActivado: false, destacado: false });
      expect(nodos.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, destacarActivado: false }),
      );
    });

    it('apaga tambien un punto que ya no es elegible', async () => {
      nodos.findOne.mockResolvedValue(
        nodo({ categoria: 'agua', destacarActivado: true }),
      );

      await expect(
        servicio.destacarNodo(5, usuario, false, AHORA),
      ).resolves.toEqual({ id: 5, destacarActivado: false, destacado: false });
    });

    it('un punto ajeno no se apaga', async () => {
      nodos.findOne.mockResolvedValue(
        nodo({ creadoPor: dueno(99), destacarActivado: true }),
      );

      esperarProhibido(
        await falla(servicio.destacarNodo(5, usuario, false, AHORA)),
        'Este nodo no te pertenece',
      );
      expect(nodos.save).not.toHaveBeenCalled();
    });
  });

  describe('destacarNodo — encender lo que ya esta encendido', () => {
    it('no guarda de nuevo ni vuelve a pedir plan o cupo (aunque este en el tope)', async () => {
      nodos.findOne.mockResolvedValue(nodo({ destacarActivado: true }));
      nodos.count.mockResolvedValue(50);

      await expect(
        servicio.destacarNodo(5, usuario, true, AHORA),
      ).resolves.toEqual({ id: 5, destacarActivado: true, destacado: true });
      expect(nodos.save).not.toHaveBeenCalled();
      expect(nodos.count).not.toHaveBeenCalled();
    });

    it('con el plan vencido responde destacado falso, sin error', async () => {
      conPlan.clear();
      nodos.findOne.mockResolvedValue(nodo({ destacarActivado: true }));

      await expect(
        servicio.destacarNodo(5, usuario, true, AHORA),
      ).resolves.toEqual({ id: 5, destacarActivado: true, destacado: false });
    });
  });

  describe('destacarEvento', () => {
    it('una empresa con plan enciende su evento', async () => {
      eventos.findOne.mockResolvedValue(evento());

      await expect(
        servicio.destacarEvento(11, empresa, true, AHORA),
      ).resolves.toEqual({ id: 11, destacarActivado: true, destacado: true });
      expect(eventos.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 11, destacarActivado: true }),
      );
    });

    it.each([
      ['un usuario normal', usuario, 7],
      ['un admin', admin, 1],
    ])('%s no puede destacar eventos', async (_caso, actor, id) => {
      eventos.findOne.mockResolvedValue(evento({ creadoPor: dueno(id) }));

      esperarProhibido(
        await falla(servicio.destacarEvento(11, actor, true, AHORA)),
        'DESTACAR_NO_ELEGIBLE',
      );
      expect(eventos.save).not.toHaveBeenCalled();
    });

    it('un evento que ya termino no se enciende', async () => {
      eventos.findOne.mockResolvedValue(
        evento({ fechaFin: new Date('2026-10-19T12:00:00Z') }),
      );

      esperarProhibido(
        await falla(servicio.destacarEvento(11, empresa, true, AHORA)),
        'DESTACAR_NO_ELEGIBLE',
      );
    });

    it('el evento de otra empresa no se toca y uno inexistente es un 404', async () => {
      eventos.findOne.mockResolvedValueOnce(evento({ creadoPor: dueno(99) }));
      esperarProhibido(
        await falla(servicio.destacarEvento(11, empresa, true, AHORA)),
        'Este evento no te pertenece',
      );

      eventos.findOne.mockResolvedValueOnce(null);
      const error = await falla(
        servicio.destacarEvento(99, empresa, true, AHORA),
      );
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        'Evento 99 no encontrado',
      );
    });

    it('sin plan, o en el tope, no se enciende; apagar siempre se puede', async () => {
      conPlan.clear();
      eventos.findOne.mockResolvedValue(evento());
      esperarProhibido(
        await falla(servicio.destacarEvento(11, empresa, true, AHORA)),
        'DESTACAR_SIN_PLAN',
      );

      conPlan.add(8);
      nodos.count.mockResolvedValue(10);
      eventos.count.mockResolvedValue(10);
      esperarProhibido(
        await falla(servicio.destacarEvento(11, empresa, true, AHORA)),
        'DESTACAR_TOPE',
      );

      eventos.findOne.mockResolvedValue(evento({ destacarActivado: true }));
      await expect(
        servicio.destacarEvento(11, empresa, false, AHORA),
      ).resolves.toEqual({ id: 11, destacarActivado: false, destacado: false });
    });
  });

  describe('nodosConDestacado — el destacado efectivo se calcula al leer', () => {
    // Planes vigentes solo para los duenos 7 y 8.
    const lista = (): Nodo[] => [
      nodo({ id: 2, categoria: 'agua', destacarActivado: true }), // B: no elegible
      nodo({ id: 1, destacarActivado: true }), // A: comercio con interruptor
      nodo({ id: 3, destacarActivado: true, creadoPor: dueno(9) }), // C: dueno sin plan
      nodo({
        id: 5,
        destacarActivado: true,
        patrocinado: true,
        categoria: 'agua',
        creadoPor: dueno(8),
      }), // E: local de empresa
      nodo({ id: 4, destacarActivado: false }), // D: interruptor apagado
      nodo({ id: 6, destacarActivado: true, estado: EstadoNodo.Rechazado }), // F: retirado
    ];

    it('solo lo encendido, elegible, visible y con plan sale destacado, y primero', async () => {
      const resultado = await servicio.nodosConDestacado(lista(), AHORA);

      expect(resultado.map((n) => [n.id, n.destacado])).toEqual([
        [1, true],
        [5, true],
        [2, false],
        [3, false],
        [4, false],
        [6, false],
      ]);
    });

    it('al renovar el plan vuelve solo, sin tocar nada', async () => {
      // Review Focus 2: el interruptor del dueno se conserva mientras vence el plan.
      conPlan.add(9);

      const resultado = await servicio.nodosConDestacado(lista(), AHORA);

      expect(resultado.find((n) => n.id === 3)?.destacado).toBe(true);
    });

    it('consulta la vigencia una sola vez, con los duenos de lo encendido sin repetir', async () => {
      await servicio.nodosConDestacado(lista(), AHORA);

      expect(vigentes.conVigencia).toHaveBeenCalledTimes(1);
      const [ids, ahora] = vigentes.conVigencia.mock.calls[0] as [
        number[],
        Date,
      ];
      expect([...ids].sort((a, b) => a - b)).toEqual([7, 8, 9]);
      expect(ahora).toBe(AHORA);
    });

    it('si no hay nada encendido no consulta la base', async () => {
      const resultado = await servicio.nodosConDestacado(
        [nodo({ id: 1 }), nodo({ id: 2 })],
        AHORA,
      );

      expect(resultado.map((n) => n.destacado)).toEqual([false, false]);
      expect(vigentes.conVigencia).not.toHaveBeenCalled();
    });

    it('una lista vacia no consulta nada', async () => {
      expect(await servicio.nodosConDestacado([], AHORA)).toEqual([]);
      expect(vigentes.conVigencia).not.toHaveBeenCalled();
    });

    it('nodoConDestacado devuelve el mismo punto con su destacado', async () => {
      const punto = nodo({ destacarActivado: true });

      const resultado = await servicio.nodoConDestacado(punto, AHORA);

      expect(resultado).toBe(punto);
      expect(resultado.destacado).toBe(true);
    });
  });

  describe('eventosConDestacado', () => {
    it('un evento terminado no sale destacado aunque siga encendido y haya plan', async () => {
      // Review Focus 2.
      const terminado = evento({
        id: 1,
        destacarActivado: true,
        fechaFin: new Date('2026-10-19T12:00:00Z'),
      });
      const proximo = evento({ id: 2, destacarActivado: true });

      const resultado = await servicio.eventosConDestacado(
        [terminado, proximo],
        AHORA,
      );

      expect(resultado.map((e) => [e.id, e.destacado])).toEqual([
        [2, true],
        [1, false],
      ]);
    });

    it('eventoConDestacado devuelve el mismo evento con su destacado', async () => {
      const unico = evento({ destacarActivado: true });

      const resultado = await servicio.eventoConDestacado(unico, AHORA);

      expect(resultado).toBe(unico);
      expect(resultado.destacado).toBe(true);
    });
  });

  describe('la lectura publica no filtra el correo del dueno', () => {
    // Review Focus 5: la entidad debe seguir siendo la misma instancia, o
    // `@SoloAutorPublico` deja de recortar `creadoPor` y salen su correo y su rol.
    it('un evento sigue exponiendo solo id y nombre de su autor', async () => {
      const original = evento({
        destacarActivado: true,
        creadoPor: dueno(8, 'Bici SA'),
      });

      const [resultado] = await servicio.eventosConDestacado([original], AHORA);

      expect(resultado).toBe(original);
      const plano = instanceToPlain(resultado) as Record<string, unknown>;
      expect(plano.destacado).toBe(true);
      expect(plano.creadoPor).toEqual({ id: 8, nombreUser: 'Bici SA' });
    });

    it('un punto tambien', async () => {
      const original = nodo({
        destacarActivado: true,
        creadoPor: dueno(7, 'Ana'),
      });

      const [resultado] = await servicio.nodosConDestacado([original], AHORA);

      expect(resultado).toBe(original);
      const plano = instanceToPlain(resultado) as Record<string, unknown>;
      expect(plano.destacado).toBe(true);
      expect(plano.creadoPor).toEqual({ id: 7, nombreUser: 'Ana' });
    });
  });
});

describe('limiteDestacados', () => {
  afterEach(() => {
    delete process.env.DESTACADOS_LIMITE;
  });

  it('por defecto son 20', () => {
    delete process.env.DESTACADOS_LIMITE;
    expect(limiteDestacados()).toBe(20);
  });

  it('se configura con un entero positivo', () => {
    process.env.DESTACADOS_LIMITE = '2';
    expect(limiteDestacados()).toBe(2);
  });

  it.each(['abc', '0', '-3', '2.5', ''])(
    'un valor invalido (%p) vuelve a 20',
    (valor) => {
      process.env.DESTACADOS_LIMITE = valor;
      expect(limiteDestacados()).toBe(20);
    },
  );
});
