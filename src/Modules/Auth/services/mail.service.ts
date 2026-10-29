import { Injectable } from '@nestjs/common';
import { AuthConfig } from '../auth.config';
import {
  CorreoPlantilla,
  plantillaCodigoRecuperacion,
  plantillaReporteRecibido,
  plantillaReporteResuelto,
} from './plantillas-correo';

@Injectable()
export class MailService {
  constructor(private readonly config: AuthConfig) {}

  async enviar(
    destinatario: string,
    asunto: string,
    texto: string,
    html?: string,
  ): Promise<void> {
    const clave = this.config.sendgridApiKey;
    const remitente = this.config.correoRemitente;
    if (!clave || !remitente) {
      throw new Error(
        'Correo no configurado: faltan SENDGRID_API_KEY y/o MAIL_FROM en el .env',
      );
    }

    const respuesta = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destinatario }] }],
        from: { email: remitente, name: 'FitQuest Go' },
        subject: asunto,
        content: [
          { type: 'text/plain', value: texto },
          ...(html ? [{ type: 'text/html', value: html }] : []),
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(
        `SendGrid rechazo el envio (${respuesta.status}): ${detalle}`,
      );
    }
  }

  enviarPlantilla(
    destinatario: string,
    plantilla: CorreoPlantilla,
  ): Promise<void> {
    return this.enviar(
      destinatario,
      plantilla.asunto,
      plantilla.texto,
      plantilla.html,
    );
  }

  enviarCodigoRecuperacion(
    destinatario: string,
    codigo: string,
  ): Promise<void> {
    return this.enviarPlantilla(
      destinatario,
      plantillaCodigoRecuperacion(codigo),
    );
  }

  enviarReporteRecibido(destinatario: string, que: string): Promise<void> {
    return this.enviarPlantilla(destinatario, plantillaReporteRecibido(que));
  }

  enviarReporteResuelto(
    destinatario: string,
    que: string,
    desactivado: boolean,
  ): Promise<void> {
    return this.enviarPlantilla(
      destinatario,
      plantillaReporteResuelto(que, desactivado),
    );
  }
}
