import { TipoAlerta } from './Alertas/tipo-alerta.enum';
import { CategoriaNodo } from './Nodos/categoria-nodo.enum';
import { ActividadRuta } from './Rutas/actividad-ruta.enum';

/**
 * Las claves de las listas cerradas son un contrato con la app Flutter
 * (`lib/core/catalogos/*.dart`, que tiene este mismo listado en
 * `test/catalogos_test.dart`). Si cambias una aqui, cambia tambien alla: la
 * app traduce cada clave (es / en / pt-BR) y una clave que no conozca se
 * mostraria cruda.
 */
describe('claves de las listas cerradas', () => {
  it('actividades de ruta', () => {
    expect(Object.values(ActividadRuta)).toEqual([
      'running',
      'ciclismo',
      'mtb',
      'hiking',
      'caminata',
      'otro',
    ]);
  });

  it('tipos de alerta', () => {
    expect(Object.values(TipoAlerta)).toEqual([
      'arbol_caido',
      'bache',
      'derrumbe',
      'inundacion',
      'perro',
      'via_cerrada',
      'accidente',
      'zona_insegura',
      'cable_caido',
      'otro',
    ]);
  });

  it('categorias de nodo', () => {
    expect(Object.values(CategoriaNodo)).toEqual([
      'agua',
      'mirador',
      'taller',
      'restaurante',
      'comercio',
      'banos',
      'parqueo',
      'primeros_auxilios',
      'otro',
    ]);
  });
});
