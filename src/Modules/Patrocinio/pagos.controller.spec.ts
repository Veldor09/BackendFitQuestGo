import { UnauthorizedException } from '@nestjs/common';
import { PagosController } from './pagos.controller';
import { SuscripcionesService } from './suscripciones.service';

describe('PagosController', () => {
  let controlador: PagosController;
  let servicio: { confirmarPago: jest.Mock; confirmarPorSesion: jest.Mock };

  beforeEach(() => {
    process.env.ONVO_WEBHOOK_SECRET = 'webhook_secret_prueba';
    servicio = {
      confirmarPago: jest.fn().mockResolvedValue('activada'),
      confirmarPorSesion: jest.fn().mockResolvedValue(undefined),
    };
    controlador = new PagosController(
      servicio as unknown as SuscripcionesService,
    );
  });

  afterEach(() => {
    delete process.env.ONVO_WEBHOOK_SECRET;
  });

  describe('retorno', () => {
    it('confirma el pago de la solicitud y avisa que quedo listo', async () => {
      const html = await controlador.retorno('7');

      expect(servicio.confirmarPago).toHaveBeenCalledWith(7);
      expect(html).toContain('Pago recibido');
    });

    it('si todavia no se confirmo, lo dice sin activar nada', async () => {
      servicio.confirmarPago.mockResolvedValue('pendiente');

      const html = await controlador.retorno('7');

      expect(html).toContain('Pago pendiente');
    });

    it('una solicitud que ya estaba activa tambien cuenta como pago recibido', async () => {
      servicio.confirmarPago.mockResolvedValue('ya_activa');

      expect(await controlador.retorno('7')).toContain('Pago recibido');
    });

    it('un parametro invalido no llega al servicio ni rompe la pagina', async () => {
      for (const s of [undefined, '', 'abc', '-3', '0', '1.5']) {
        const html = await controlador.retorno(s);
        expect(html).toContain('Pago pendiente');
      }
      expect(servicio.confirmarPago).not.toHaveBeenCalled();
    });

    it('si consultar la pasarela falla, muestra pendiente en vez de un error', async () => {
      servicio.confirmarPago.mockRejectedValue(new Error('ONVO respondio 500'));

      expect(await controlador.retorno('7')).toContain('Pago pendiente');
    });
  });

  describe('cancelado', () => {
    it('dice que el pago se cancelo', () => {
      expect(controlador.cancelado()).toContain('Pago cancelado');
    });
  });

  describe('webhook de ONVO', () => {
    const evento = {
      type: 'checkout-session.succeeded',
      data: { id: 'cs_1' },
    };

    it('con el secreto correcto confirma la sesion pagada', async () => {
      await expect(
        controlador.webhookOnvo('webhook_secret_prueba', evento),
      ).resolves.toEqual({ recibido: true });

      expect(servicio.confirmarPorSesion).toHaveBeenCalledWith('cs_1');
    });

    it('sin secreto, o con uno distinto, responde 401 y no toca nada', async () => {
      await expect(
        controlador.webhookOnvo(undefined, evento),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        controlador.webhookOnvo('otro_secreto', evento),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        controlador.webhookOnvo('webhook_secret_prueba_', evento),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(servicio.confirmarPorSesion).not.toHaveBeenCalled();
    });

    it('si el servidor no tiene ONVO_WEBHOOK_SECRET, rechaza todo (aunque venga vacio)', async () => {
      delete process.env.ONVO_WEBHOOK_SECRET;

      await expect(controlador.webhookOnvo('', evento)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        controlador.webhookOnvo(undefined, evento),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(servicio.confirmarPorSesion).not.toHaveBeenCalled();
    });

    it('otros tipos de evento se reciben pero se ignoran', async () => {
      await expect(
        controlador.webhookOnvo('webhook_secret_prueba', {
          type: 'payment-intent.failed',
          data: { id: 'pi_1' },
        }),
      ).resolves.toEqual({ recibido: true });

      expect(servicio.confirmarPorSesion).not.toHaveBeenCalled();
    });

    it('un cuerpo mal formado no rompe', async () => {
      for (const cuerpo of [
        undefined,
        null,
        'x',
        {},
        { type: 'checkout-session.succeeded' },
      ]) {
        await expect(
          controlador.webhookOnvo('webhook_secret_prueba', cuerpo),
        ).resolves.toEqual({ recibido: true });
      }
      expect(servicio.confirmarPorSesion).not.toHaveBeenCalled();
    });
  });
});
