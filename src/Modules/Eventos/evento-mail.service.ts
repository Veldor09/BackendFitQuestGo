import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AuthConfig } from '../Auth/auth.config';

@Injectable()
export class EventoMailService {
  constructor(private readonly config: AuthConfig) {}

  async enviarDecision(destinatario: string, nombre: string,
    tipo: string, estado: 'Aprobado' | 'Denegado'): Promise<void> {
    const usuario = this.config.gmailUser;
    const clave = this.config.gmailAppPassword;
    if (!usuario || !clave) throw new Error('Correo no configurado');
    const transporte = nodemailer.createTransport({
      service: 'gmail', auth: { user: usuario, pass: clave },
    });
    await transporte.sendMail({
      from: `"FitQuest Go" <${usuario}>`,
      to: destinatario,
      subject: `Tu ${tipo} fue ${estado === 'Aprobado' ? 'aprobado' : 'denegado'}`,
      text: `El ${tipo} "${nombre}" fue ${estado.toLowerCase()}. ` +
        (estado === 'Aprobado' ? 'Ya está visible en FitQuest Go.' : 'No se publicará en FitQuest Go.'),
    });
  }
}
