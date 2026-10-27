import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import {
  type SolicitudPush,
  TipoPush,
} from '../Notificaciones/push/push-plantillas';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';

describe('PatrocinioAvisosService — avisos al dueno del plan', () => {
  let notificaciones: { crear: jest.Mock; yaAvisada: jest.Mock };
  let servicio: PatrocinioAvisosService;

  beforeEach(() => {
    notificaciones = {
      crear: jest.fn().mockResolvedValue({ id: 1 }),
      yaAvisada: jest.fn().mockResolvedValue(false),
    };
    servicio = new PatrocinioAvisosService(
      notificaciones as unknown as NotificacionesService,
    );
  });

  const esperado = (titulo: string, mensaje: string, push: SolicitudPush) => ({
    idUsuario: 4,
    categoria: CategoriaNotificacion.Patrocinio,
    titulo,
    mensaje,
    referenciaTipo: ReferenciaTipoNotificacion.Suscripcion,
    referenciaId: 9,
    push,
  });

  it('plan aprobado', async () => {
    await servicio.planAprobado(4, 9);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      esperado(
        'Tu plan de patrocinio fue aprobado',
        'Ya puedes destacar tus comercios y eventos durante 30 días.',
        { tipo: TipoPush.PlanAprobado },
      ),
    );
  });

  it('solicitud rechazada', async () => {
    await servicio.planRechazado(4, 9);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      esperado(
        'Tu solicitud de plan fue rechazada',
        'Puedes enviar una nueva solicitud cuando quieras.',
        { tipo: TipoPush.PlanRechazado },
      ),
    );
  });

  it('plan suspendido', async () => {
    await servicio.planSuspendido(4, 9);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      esperado(
        'Tu plan de patrocinio fue suspendido',
        'Tus publicaciones dejaron de verse como destacadas. Si crees que es un error, escribe al equipo de FitQuest Go.',
        { tipo: TipoPush.PlanSuspendido },
      ),
    );
  });

  it('plan vencido: avisa una vez y devuelve true', async () => {
    await expect(servicio.planVencido(4, 9)).resolves.toBe(true);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      esperado(
        'Tu plan de patrocinio venció',
        'Tus publicaciones siguen visibles, pero ya no aparecen como destacadas. Renueva tu plan para volver a destacarlas.',
        { tipo: TipoPush.PlanVencido },
      ),
    );
  });

  it('plan por vencer: fecha larga en hora de Costa Rica', async () => {
    await expect(
      servicio.planPorVencer(4, 9, new Date('2026-10-23T18:00:00Z')),
    ).resolves.toBe(true);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      esperado(
        'Tu plan de patrocinio vence pronto',
        'Vence el 23 de octubre de 2026. Renuévalo para que tus publicaciones sigan destacadas.',
        {
          tipo: TipoPush.PlanPorVencer,
          params: { venceEn: '2026-10-23T18:00:00.000Z' },
        },
      ),
    );
  });

  it('por vencer y vencido no se repiten si ya se avisaron', async () => {
    notificaciones.yaAvisada.mockResolvedValue(true);

    await expect(
      servicio.planPorVencer(4, 9, new Date('2026-10-23T18:00:00Z')),
    ).resolves.toBe(false);
    await expect(servicio.planVencido(4, 9)).resolves.toBe(false);

    expect(notificaciones.crear).not.toHaveBeenCalled();
    expect(notificaciones.yaAvisada).toHaveBeenCalledWith(
      4,
      ReferenciaTipoNotificacion.Suscripcion,
      9,
      'Tu plan de patrocinio venció',
    );
  });

  it('si la notificacion no se pudo guardar (crear devuelve null) no cuenta como avisada', async () => {
    notificaciones.crear.mockResolvedValue(null);
    await expect(servicio.planVencido(4, 9)).resolves.toBe(false);
  });
  it('plan aprobado dice los dias reales del plan', async () => {
    await servicio.planAprobado(4, 9, 45);
    expect(notificaciones.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: 'Ya puedes destacar tus comercios y eventos durante 45 días.',
      }),
    );
  });

  it('solicitud rechazada con motivo: la persona lo lee, sin puntos de mas', async () => {
    await servicio.planRechazado(4, 9, 'Faltan datos del comercio');
    await servicio.planRechazado(4, 9, 'Datos incompletos.  ');
    const mensajes = notificaciones.crear.mock.calls.map(
      ([p]: [{ mensaje: string }]) => p.mensaje,
    );
    expect(mensajes[0]).toBe(
      'Motivo: Faltan datos del comercio. Puedes enviar una nueva solicitud cuando quieras.',
    );
    expect(mensajes[1]).toBe(
      'Motivo: Datos incompletos. Puedes enviar una nueva solicitud cuando quieras.',
    );
  });
});
