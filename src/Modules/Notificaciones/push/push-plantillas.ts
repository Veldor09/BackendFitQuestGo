/**
 * Los unicos avisos que salen del telefono. Lista cerrada a proposito: solo el
 * resultado de algo que la persona pidio y que decide otro (moderacion, el
 * equipo) o el tiempo (vencimientos). Nada de "tu ruta se guardo", "alguien
 * voto" ni recordatorios: eso se ve dentro de la app, en la campana.
 */
export enum TipoPush {
  RutaAprobada = 'ruta_aprobada',
  RutaRechazada = 'ruta_rechazada',
  NodoAprobado = 'nodo_aprobado',
  NodoRechazado = 'nodo_rechazado',
  AlertaResuelta = 'alerta_resuelta',
  PlanAprobado = 'plan_aprobado',
  PlanRechazado = 'plan_rechazado',
  PlanSuspendido = 'plan_suspendido',
  PlanPorVencer = 'plan_por_vencer',
  PlanVencido = 'plan_vencido',
}

export type IdiomaPush = 'es' | 'en' | 'pt';
export const IDIOMAS_PUSH: readonly IdiomaPush[] = ['es', 'en', 'pt'];

/** Que avisar y con que datos; el texto lo arma [textoPush] segun el idioma. */
export interface SolicitudPush {
  tipo: TipoPush;
  /** `nombre` (de la ruta o el punto) y `venceEn` (fecha ISO) segun el tipo. */
  params?: { nombre?: string; venceEn?: string };
}

interface Texto {
  titulo: string;
  cuerpo: string;
}

type Plantilla = (p: { nombre: string; fecha: string }) => Texto;

const PLANTILLAS: Record<TipoPush, Record<IdiomaPush, Plantilla>> = {
  [TipoPush.RutaAprobada]: {
    es: ({ nombre }) => ({
      titulo: '¡Tu ruta fue aprobada!',
      cuerpo: `"${nombre}" ya es pública y visible para la comunidad.`,
    }),
    en: ({ nombre }) => ({
      titulo: 'Your route was approved!',
      cuerpo: `"${nombre}" is now public and visible to the community.`,
    }),
    pt: ({ nombre }) => ({
      titulo: 'Sua rota foi aprovada!',
      cuerpo: `"${nombre}" agora é pública e visível para a comunidade.`,
    }),
  },
  [TipoPush.RutaRechazada]: {
    es: ({ nombre }) => ({
      titulo: 'Tu ruta no fue aprobada',
      cuerpo: `"${nombre}" no cumple los criterios de publicación. Revisa los detalles en la app.`,
    }),
    en: ({ nombre }) => ({
      titulo: 'Your route was not approved',
      cuerpo: `"${nombre}" does not meet the publishing criteria. See the details in the app.`,
    }),
    pt: ({ nombre }) => ({
      titulo: 'Sua rota não foi aprovada',
      cuerpo: `"${nombre}" não atende aos critérios de publicação. Veja os detalhes no app.`,
    }),
  },
  [TipoPush.NodoAprobado]: {
    es: ({ nombre }) => ({
      titulo: '¡Tu punto de interés fue aprobado!',
      cuerpo: `"${nombre}" ya es visible en el mapa.`,
    }),
    en: ({ nombre }) => ({
      titulo: 'Your point of interest was approved!',
      cuerpo: `"${nombre}" is now visible on the map.`,
    }),
    pt: ({ nombre }) => ({
      titulo: 'Seu ponto de interesse foi aprovado!',
      cuerpo: `"${nombre}" agora está visível no mapa.`,
    }),
  },
  [TipoPush.NodoRechazado]: {
    es: ({ nombre }) => ({
      titulo: 'Tu punto de interés no fue aprobado',
      cuerpo: `"${nombre}" no cumple los criterios de moderación.`,
    }),
    en: ({ nombre }) => ({
      titulo: 'Your point of interest was not approved',
      cuerpo: `"${nombre}" does not meet the moderation criteria.`,
    }),
    pt: ({ nombre }) => ({
      titulo: 'Seu ponto de interesse não foi aprovado',
      cuerpo: `"${nombre}" não atende aos critérios de moderação.`,
    }),
  },
  [TipoPush.AlertaResuelta]: {
    es: () => ({
      titulo: 'Tu alerta fue marcada como resuelta',
      cuerpo: 'Un administrador verificó tu reporte y lo marcó como resuelto.',
    }),
    en: () => ({
      titulo: 'Your alert was marked as resolved',
      cuerpo: 'An administrator checked your report and marked it as resolved.',
    }),
    pt: () => ({
      titulo: 'Seu alerta foi marcado como resolvido',
      cuerpo:
        'Um administrador verificou seu relatório e o marcou como resolvido.',
    }),
  },
  [TipoPush.PlanAprobado]: {
    es: () => ({
      titulo: 'Tu plan de patrocinio fue aprobado',
      cuerpo: 'Ya puedes destacar tus comercios y eventos.',
    }),
    en: () => ({
      titulo: 'Your sponsorship plan was approved',
      cuerpo: 'You can now feature your businesses and events.',
    }),
    pt: () => ({
      titulo: 'Seu plano de patrocínio foi aprovado',
      cuerpo: 'Agora você pode destacar seus comércios e eventos.',
    }),
  },
  [TipoPush.PlanRechazado]: {
    es: () => ({
      titulo: 'Tu solicitud de plan fue rechazada',
      cuerpo: 'Puedes enviar una nueva solicitud cuando quieras.',
    }),
    en: () => ({
      titulo: 'Your plan request was declined',
      cuerpo: 'You can send a new request whenever you like.',
    }),
    pt: () => ({
      titulo: 'Sua solicitação de plano foi recusada',
      cuerpo: 'Você pode enviar uma nova solicitação quando quiser.',
    }),
  },
  [TipoPush.PlanSuspendido]: {
    es: () => ({
      titulo: 'Tu plan de patrocinio fue suspendido',
      cuerpo: 'Tus publicaciones dejaron de verse como destacadas.',
    }),
    en: () => ({
      titulo: 'Your sponsorship plan was suspended',
      cuerpo: 'Your listings are no longer shown as featured.',
    }),
    pt: () => ({
      titulo: 'Seu plano de patrocínio foi suspenso',
      cuerpo: 'Suas publicações deixaram de aparecer como destacadas.',
    }),
  },
  [TipoPush.PlanPorVencer]: {
    es: ({ fecha }) => ({
      titulo: 'Tu plan de patrocinio vence pronto',
      cuerpo: `Vence el ${fecha}. Renuévalo para seguir destacado.`,
    }),
    en: ({ fecha }) => ({
      titulo: 'Your sponsorship plan expires soon',
      cuerpo: `It expires on ${fecha}. Renew it to stay featured.`,
    }),
    pt: ({ fecha }) => ({
      titulo: 'Seu plano de patrocínio vence em breve',
      cuerpo: `Vence em ${fecha}. Renove para continuar em destaque.`,
    }),
  },
  [TipoPush.PlanVencido]: {
    es: () => ({
      titulo: 'Tu plan de patrocinio venció',
      cuerpo:
        'Tus publicaciones ya no aparecen como destacadas. Renueva tu plan para volver a destacarlas.',
    }),
    en: () => ({
      titulo: 'Your sponsorship plan has expired',
      cuerpo:
        'Your listings are no longer featured. Renew your plan to feature them again.',
    }),
    pt: () => ({
      titulo: 'Seu plano de patrocínio venceu',
      cuerpo:
        'Suas publicações não aparecem mais em destaque. Renove seu plano para destacá-las novamente.',
    }),
  },
};

const LOCALE_FECHA: Record<IdiomaPush, string> = {
  es: 'es-CR',
  en: 'en-US',
  pt: 'pt-BR',
};

/** Un idioma que no conocemos cae en español (el de la app por defecto). */
export function idiomaPushValido(idioma?: string | null): IdiomaPush {
  const base = (idioma ?? '').toLowerCase().slice(0, 2);
  return (IDIOMAS_PUSH as readonly string[]).includes(base)
    ? (base as IdiomaPush)
    : 'es';
}

/** El titulo y el cuerpo del aviso en el idioma del telefono. */
export function textoPush(
  solicitud: SolicitudPush,
  idioma?: string | null,
): Texto {
  const lengua = idiomaPushValido(idioma);
  const venceEn = solicitud.params?.venceEn
    ? new Date(solicitud.params.venceEn)
    : null;
  const fecha =
    venceEn && !Number.isNaN(venceEn.getTime())
      ? venceEn.toLocaleDateString(LOCALE_FECHA[lengua], {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Costa_Rica',
        })
      : '';
  return PLANTILLAS[solicitud.tipo][lengua]({
    nombre: solicitud.params?.nombre ?? '',
    fecha,
  });
}
