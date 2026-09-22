import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AuthConfig } from '../auth.config';

@Injectable()
export class MailService {
  constructor(private readonly config: AuthConfig) {}

  async enviarCodigoRecuperacion(
    destinatario: string,
    codigo: string,
  ): Promise<void> {
    const usuario = this.config.gmailUser;
    const clave = this.config.gmailAppPassword;
    if (!usuario || !clave) {
      throw new Error(
        'Correo no configurado: faltan GMAIL_USER y/o GMAIL_APP_PASSWORD en el .env',
      );
    }

    const transporte = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: usuario, pass: clave },
    });

    await transporte.sendMail({
      from: `"FitQuest Go" <${usuario}>`,
      to: destinatario,
      subject: 'Codigo para restablecer tu contrasena',
      text:
        `Tu codigo para restablecer la contrasena de FitQuest Go es: ${codigo}\n\n` +
        'Vence en 15 minutos. Si no pediste este codigo, ignora este correo.',
    });
  }
}
