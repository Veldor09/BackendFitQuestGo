import { Logger } from '@nestjs/common';
import {
  CronExpression,
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { AlertaExpiracionTask } from './alerta-expiracion.task';
import { AlertaService } from './alerta.service';

describe('AlertaExpiracionTask — las alertas vencen solas', () => {
  let servicio: { expirarVencidas: jest.Mock<Promise<number>, []> };
  let tarea: AlertaExpiracionTask;
  let modulo: TestingModule;
  let aviso: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(async () => {
    servicio = {
      expirarVencidas: jest.fn<Promise<number>, []>().mockResolvedValue(0),
    };
    aviso = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    modulo = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        AlertaExpiracionTask,
        { provide: AlertaService, useValue: servicio },
      ],
    }).compile();
    tarea = modulo.get(AlertaExpiracionTask);
    // Nest registra por Logger sus propios avisos de arranque: no cuentan.
    aviso.mockClear();
  });

  afterEach(async () => {
    await modulo.close();
    jest.restoreAllMocks();
  });

  describe('cada pasada', () => {
    it('le pide al servicio que expire las vencidas', async () => {
      await tarea.expirarVencidas();
      expect(servicio.expirarVencidas).toHaveBeenCalledTimes(1);
    });

    it('deja constancia cuando expiro alguna', async () => {
      servicio.expirarVencidas.mockResolvedValue(3);
      await tarea.expirarVencidas();
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('3'));
    });

    it('no dice nada cuando no vencio ninguna (corre cada minuto)', async () => {
      servicio.expirarVencidas.mockResolvedValue(0);
      await tarea.expirarVencidas();
      expect(aviso).not.toHaveBeenCalled();
    });

    it('si la base falla no propaga el error: el minuto siguiente reintenta', async () => {
      servicio.expirarVencidas.mockRejectedValue(new Error('conexion perdida'));

      await expect(tarea.expirarVencidas()).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('No se pudieron expirar'),
        expect.stringContaining('conexion perdida'),
      );
    });
  });

  it('al arrancar pone al dia lo que vencio con el servidor apagado', async () => {
    await tarea.onApplicationBootstrap();
    expect(servicio.expirarVencidas).toHaveBeenCalledTimes(1);
  });

  it('queda programada como tarea cron de cada minuto', async () => {
    await modulo.init();

    const registro = modulo.get(SchedulerRegistry);
    expect(registro.doesExist('cron', 'expirar-alertas')).toBe(true);
    expect(registro.getCronJob('expirar-alertas').cronTime.source).toBe(
      CronExpression.EVERY_MINUTE,
    );
  });
});
