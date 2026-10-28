export interface CorreoPlantilla {
  asunto: string;
  texto: string;
  html: string;
}

const COLOR = {
  night: '#13233F',
  night2: '#1D3154',
  volt: '#B9F227',
  ink: '#17211E',
  muted: '#67726D',
  cloud: '#F4F6F2',
  paper: '#FBFCF8',
  border: '#DFE4DD',
  white: '#FFFFFF',
  chip: '#EEF9D4',
  chipInk: '#25330F',
  info: '#EAF4FF',
  infoInk: '#3E5D7C',
};

const FUENTE = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parrafo(contenido: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${COLOR.ink};">${contenido}</p>`;
}

function etiqueta(texto: string, fondo: string, tinta: string): string {
  return `<span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${fondo};color:${tinta};font-family:${FUENTE};font-size:12px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;">${escaparHtml(texto)}</span>`;
}

function marco(opciones: {
  resumen: string;
  titulo: string;
  cuerpo: string;
  pie: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escaparHtml(opciones.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.cloud};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.cloud};">${escaparHtml(opciones.resumen)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.cloud};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:${COLOR.night};border-radius:24px 24px 0 0;padding:28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:${COLOR.volt};border-radius:12px;width:40px;height:40px;text-align:center;font-family:${FUENTE};font-size:20px;font-weight:900;color:${COLOR.night};line-height:40px;">F</td>
<td style="padding-left:12px;font-family:${FUENTE};font-size:22px;font-weight:800;letter-spacing:-0.3px;color:${COLOR.white};">FitQuest <span style="color:${COLOR.volt};">Go</span></td>
</tr></table>
</td></tr>
<tr><td style="height:4px;background:${COLOR.volt};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:${COLOR.white};border-left:1px solid ${COLOR.border};border-right:1px solid ${COLOR.border};padding:32px;">
<h1 style="margin:0 0 20px 0;font-family:${FUENTE};font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.5px;color:${COLOR.ink};">${escaparHtml(opciones.titulo)}</h1>
${opciones.cuerpo}
</td></tr>
<tr><td style="background:${COLOR.paper};border:1px solid ${COLOR.border};border-top:0;border-radius:0 0 24px 24px;padding:20px 32px;">
<p style="margin:0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${COLOR.muted};">${opciones.pie}</p>
</td></tr>
<tr><td align="center" style="padding:20px 8px 0 8px;font-family:${FUENTE};font-size:11px;color:${COLOR.muted};">FitQuest Go · Explora, muévete y comparte tus rutas</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function plantillaCodigoRecuperacion(codigo: string): CorreoPlantilla {
  const cuerpo =
    parrafo('Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa este código en la app:') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr><td align="center" style="background:${COLOR.chip};border:1px solid #D1E8CA;border-radius:18px;padding:22px 12px;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:${COLOR.chipInk};">${escaparHtml(codigo)}</td></tr></table>` +
    parrafo('Vence en <strong>15 minutos</strong>.');
  return {
    asunto: 'Código para restablecer tu contraseña',
    texto:
      `Tu código para restablecer la contraseña de FitQuest Go es: ${codigo}\n\n` +
      'Vence en 15 minutos. Si no pediste este código, ignora este correo.',
    html: marco({
      resumen: `Tu código es ${codigo}. Vence en 15 minutos.`,
      titulo: 'Restablece tu contraseña',
      cuerpo,
      pie: 'Si no pediste este código, ignora este correo: tu contraseña no cambiará. Nunca compartas este código con nadie.',
    }),
  };
}

export function plantillaReporteRecibido(que: string): CorreoPlantilla {
  const cuerpo =
    `<div style="margin:0 0 18px 0;">${etiqueta('Reporte recibido', COLOR.info, COLOR.infoInk)}</div>` +
    parrafo(`Recibimos tu reporte sobre <strong>${escaparHtml(que)}</strong>.`) +
    parrafo('Lo revisaremos y te avisaremos por este medio con lo que se decida.') +
    parrafo('Gracias por ayudarnos a cuidar la comunidad de FitQuest Go.');
  return {
    asunto: 'Recibimos tu reporte',
    texto:
      `Recibimos tu reporte sobre ${que}.\n\n` +
      'Lo revisaremos y te avisaremos por este medio con lo que se decida.\n\n' +
      'Gracias por ayudarnos a cuidar la comunidad de FitQuest Go.',
    html: marco({
      resumen: 'Recibimos tu reporte y lo revisaremos pronto.',
      titulo: 'Recibimos tu reporte',
      cuerpo,
      pie: 'Recibes este correo porque enviaste un reporte desde la app de FitQuest Go.',
    }),
  };
}

export function plantillaReporteResuelto(
  que: string,
  desactivado: boolean,
): CorreoPlantilla {
  const asunto = desactivado
    ? 'Revisamos tu reporte: se desactivó'
    : 'Revisamos tu reporte: se conserva';
  const decision = desactivado
    ? `Se ha desactivado ${que} porque, tras revisar tu reporte, sí infringe las normas de FitQuest Go.`
    : `No se ha desactivado ${que} porque, tras revisar tu reporte, no infringe las normas de FitQuest Go.`;
  const decisionHtml = desactivado
    ? `Se ha desactivado <strong>${escaparHtml(que)}</strong> porque, tras revisar tu reporte, sí infringe las normas de FitQuest Go.`
    : `No se ha desactivado <strong>${escaparHtml(que)}</strong> porque, tras revisar tu reporte, no infringe las normas de FitQuest Go.`;
  const cuerpo =
    `<div style="margin:0 0 18px 0;">${
      desactivado
        ? etiqueta('Contenido desactivado', COLOR.chip, COLOR.chipInk)
        : etiqueta('Contenido conservado', COLOR.info, COLOR.infoInk)
    }</div>` +
    parrafo(decisionHtml) +
    parrafo('Gracias por ayudarnos a cuidar la comunidad.');
  return {
    asunto,
    texto: `${decision}\n\nGracias por ayudarnos a cuidar la comunidad.`,
    html: marco({
      resumen: desactivado
        ? 'Revisamos tu reporte y el contenido fue desactivado.'
        : 'Revisamos tu reporte y el contenido se conserva.',
      titulo: 'Revisamos tu reporte',
      cuerpo,
      pie: 'Recibes este correo porque enviaste un reporte desde la app de FitQuest Go.',
    }),
  };
}
