import { Injectable } from '@nestjs/common';
import { AuthConfig } from '../auth.config';

@Injectable()
export class MailService {
  constructor(private readonly config: AuthConfig) {}

  async enviar(
    destinatario: string,
    asunto: string,
    texto: string,
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
        content: [{ type: 'text/plain', value: texto }],
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

  async enviarCodigoRecuperacion(
    destinatario: string,
    codigo: string,
  ): Promise<void> {
    await this.enviar(
      destinatario,
      'Codigo para restablecer tu contrasena',
      `Tu codigo para restablecer la contrasena de FitQuest Go es: ${codigo}\n\n` +
        'Vence en 15 minutos. Si no pediste este codigo, ignora este correo.',
    );
  }
}
