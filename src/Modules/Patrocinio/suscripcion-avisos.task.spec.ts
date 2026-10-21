import { Logger } from '@nestjs/common';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { SuscripcionAvisosTask } from './suscripcion-avisos.task';
import { SUSCRIPCIONES_VIGENTES } from './suscripciones-vigentes';

const AHORA = new Date('2026-10-20T15:00:00Z');
const DIA = 24 * 60 * 60 * 1000;

describe('SuscripcionAvisosTask — recordatorios de vencimiento', () => {
  let vigentes: { conVigencia: jest.Mock; vencenEntre: jest.Mock };
  let avisos: { planPorVencer: jest.Mock; planVencido: jest.Mock };
  let tarea: SuscripcionAvisosTask;
  let modulo: TestingModule;
  let error: jest.SpyInstance;

  beforeEach(async () => {
    vigentes = {
      conVigencia: jest.fn().mockResolvedValue(new Set<number>()),
      vencenEntre: jest.fn().mockResolvedValue([]),
    };
    avisos = {
      planPorVencer: jest.fn().mockResolvedValue(true),
      planVencido: jest.fn().mockResolvedValue(true),
    };
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    modulo = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        SuscripcionAvisosTask,
        { provide: SUSCRIPCIONES_VIGENTES, useValue: vigentes },
        { provide: PatrocinioAvisosService, useValue: avisos },
      ],
    }).compile();
    tarea = modulo.get(SuscripcionAvisosTask);
  });

  afterEach(async () => {
    await modulo.close();
    jest.restoreAllMocks();
  });

  const porVencer = {
    suscripcionId: 9,
    usuarioId: 4,
    venceEn: new Date(AHORA.getTime() + 2 * DIA),
  };

  it('pide las dos ventanas: por vencer (ahora, +3 dias] y vencidas (-7 dias, ahora]', async () => {
    await tarea.avisarVencimientos(AHORA);

    expect(vigentes.vencenEntre).toHaveBeenCalledWith(
      AHORA,
      new Date(AHORA.getTime() + 3 * DIA),
    );
    expect(vigentes.vencenEntre).toHaveBeenCalledWith(
      new Date(AHORA.getTime() - 7 * DIA),
      AHORA,
    );
  });

  it('avisa lo que esta por vencer y lo que ya vencio, y cuenta los avisos creados', async () => {
    vigentes.vencenEntre
      .mockResolvedValueOnce([porVencer])
      .mockResolvedValueOnce([
        {
          suscripcionId: 7,
          usuarioId: 5,
          venceEn: new Date(AHORA.getTime() - DIA),
        },
      ]);

    await expect(tarea.avisarVencimientos(AHORA)).resolves.toEqual({
      porVencer: 1,
      vencidas: 1,
    });
    expect(avisos.planPorVencer).toHaveBeenCalledWith(4, 9, porVencer.venceEn);
    expect(avisos.planVencido).toHaveBeenCalledWith(5, 7);
  });

  it('un aviso que ya existia no se cuenta', async () => {
    vigentes.vencenEntre.mockResolvedValueOnce([porVencer]);
    avisos.planPorVencer.mockResolvedValue(false);

    await expect(tarea.avisarVencimientos(AHORA)).resolves.toEqual({
      porVencer: 0,
      vencidas: 0,
    });
  });

  it('salta a quien ya renovo (tiene vigencia al final de la ventana)', async () => {
    vigentes.vencenEntre
      .mockResolvedValueOnce([porVencer])
      .mockResolvedValueOnce([
        {
          suscripcionId: 7,
          usuarioId: 5,
          venceEn: new Date(AHORA.getTime() - DIA),
        },
      ]);
    vigentes.conVigencia.mockResolvedValue(new Set([4, 5]));

    await expect(tarea.avisarVencimientos(AHORA)).resolves.toEqual({
      porVencer: 0,
      vencidas: 0,
    });
    expect(avisos.planPorVencer).not.toHaveBeenCalled();
    expect(avisos.planVencido).not.toHaveBeenCalled();
    // por vencer: vigencia al final de su ventana; vencidas: vigencia ahora.
    expect(vigentes.conVigencia).toHaveBeenCalledWith(
      [4],
      new Date(AHORA.getTime() + 3 * DIA),
    );
    expect(vigentes.conVigencia).toHaveBeenCalledWith([5], AHORA);
  });

  it('si la base falla registra el error y no lanza', async () => {
    vigentes.vencenEntre.mockRejectedValue(new Error('conexion perdida'));

    await expect(tarea.avisarVencimientos(AHORA)).resolves.toEqual({
      porVencer: 0,
      vencidas: 0,
    });
    expect(error).toHaveBeenCalled();
  });

  it('al arrancar hace una pasada, por si el servidor estaba dormido a las 9:00', async () => {
    await tarea.onApplicationBootstrap();
    expect(vigentes.vencenEntre).toHaveBeenCalledTimes(2);
  });

  it('queda programada todos los dias a las 9:00 de Costa Rica', async () => {
    await modulo.init();
    const registro = modulo.get(SchedulerRegistry);

    expect(registro.doesExist('cron', 'avisos-suscripciones')).toBe(true);
    expect(registro.getCronJob('avisos-suscripciones').cronTime.source).toBe(
      '0 9 * * *',
    );
  });
});
