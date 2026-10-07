import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const RONDAS = 12;

@Injectable()
export class ContrasenasServicio {
  hashear(contrasenaPlana: string): Promise<string> {
    return bcrypt.hash(contrasenaPlana, RONDAS);
  }

  verificar(contrasenaPlana: string, hash: string): Promise<boolean> {
    return bcrypt.compare(contrasenaPlana, hash);
  }
}
