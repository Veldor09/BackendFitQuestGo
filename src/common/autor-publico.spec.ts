import 'reflect-metadata';
import { instanceToPlain } from 'class-transformer';
import { Alerta } from '../Modules/Alertas/alerta.entity';
import { Nodo } from '../Modules/Nodos/nodo.entity';
import { Ruta } from '../Modules/Rutas/ruta.entity';
import { User } from '../Modules/Usuarios/user.entity';

/** Una persona completa, como la carga TypeORM con la relacion eager. */
const personaCompleta = (): User =>
  Object.assign(new User(), {
    id: 7,
    nombreUser: 'Ana',
    emailUser: 'ana@correo.com',
    passwordUserHash: 'hash-secreto',
    idrol: 1,
    estado: 'Activado',
    terminosAceptadosEn: new Date('2026-09-20T10:00:00Z'),
    rol: { idrol: 1, nombreRol: 'UserNormal' },
  });

const entidades: Array<[string, () => Alerta | Nodo | Ruta]> = [
  ['Alerta', () => new Alerta()],
  ['Nodo', () => new Nodo()],
  ['Ruta', () => new Ruta()],
];

describe.each(entidades)(
  'quien creo un(a) %s: solo se publica su id y su nombre',
  (_nombre, nueva) => {
    const conAutor = (creadoPor: unknown) =>
      Object.assign(nueva(), { id: 1, creadoPor });

    it('no lleva su correo ni ningun otro dato de la cuenta', () => {
      const plano = instanceToPlain(conAutor(personaCompleta())) as {
        creadoPor: Record<string, unknown>;
      };

      expect(plano.creadoPor).toEqual({ id: 7, nombreUser: 'Ana' });
      expect(JSON.stringify(plano)).not.toContain('ana@correo.com');
    });

    it('recien creada (solo se conoce el id) sale solo con el id', () => {
      const plano = instanceToPlain(conAutor({ id: 7 })) as {
        creadoPor: Record<string, unknown>;
      };

      expect(plano.creadoPor).toEqual({ id: 7 });
    });

    it('si la relacion no se cargo no inventa nada', () => {
      const plano = instanceToPlain(conAutor(undefined)) as Record<
        string,
        unknown
      >;

      expect(plano.creadoPor).toBeUndefined();
    });

    it('funciona tambien dentro de una lista (como las devuelve la API)', () => {
      const plano = instanceToPlain([
        conAutor(personaCompleta()),
        conAutor(personaCompleta()),
      ]) as Array<{ creadoPor: Record<string, unknown> }>;

      expect(plano.map((p) => p.creadoPor)).toEqual([
        { id: 7, nombreUser: 'Ana' },
        { id: 7, nombreUser: 'Ana' },
      ]);
    });
  },
);
