import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../Auditoria/auditoria.service';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { EstadoSuscripcion, Suscripcion } from './suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';

/**
 * El empalme entre ADM-09A (aprobar / rechazar una solicitud) y los avisos al
 * dueno del plan: lo que el admin decide le llega a la persona.
 */
describe('SuscripcionesService - avisos al decidir una solicitud', () => {
  let solicitud: Partial<Suscripcion>;
  let suscripciones: { findOne: jest.Mock; save: jest.Mock };
  let avisos: { planAprobado: jest.Mock; planRechazado: jest.Mock };
  let servicio: SuscripcionesService;

  const construir = (conAvisos: boolean) => {
    const manager = {
      getRepository: jest.fn().mockImplementation((entidad: unknown) => {
        if (entidad === Suscripcion) return suscripciones;
        if (entidad === PlanPatrocinio) {
          return {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 1, duracionDias: 45, activo: true }),
          };
        }
        if (entidad === PrecioPatrocinio) {
          return {
            findOne: jest.fn().mockResolvedValue({ importe: '10000.00' }),
          };
        }
        throw new Error('Repositorio no configurado en la prueba');
      }),
    };
    return new SuscripcionesService(
      {} as Repository<PlanPatrocinio>,
      {} as Repository<PrecioPatrocinio>,
      {} as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      { registrar: jest.fn() } as unknown as AuditoriaService,
      {
        transaction: jest
          .fn()
          .mockImplementation((operacion: (m: unknown) => unknown) =>
            Promise.resolve(operacion(manager)),
          ),
      } as unknown as DataSource,
      conAvisos ? (avisos as unknown as PatrocinioAvisosService) : undefined,
    );
  };

  beforeEach(() => {
    solicitud = {
      id: 25,
      usuarioId: 10,
      planId: 1,
      estado: EstadoSuscripcion.Solicitada,
      moneda: 'CRC',
    };
    suscripciones = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(solicitud)),
      save: jest.fn().mockImplementation((s: unknown) => Promise.resolve(s)),
    };
    avisos = {
      planAprobado: jest.fn().mockResolvedValue(undefined),
      planRechazado: jest.fn().mockResolvedValue(undefined),
    };
    servicio = construir(true);
  });

  it('al aprobar avisa al dueno del plan con los dias reales del plan', async () => {
    await servicio.aprobarSuscripcion(25, 3);

    expect(avisos.planAprobado).toHaveBeenCalledWith(10, 25, 45);
  });

  it('al rechazar avisa al dueno del plan con el motivo que escribio el admin', async () => {
    const motivo = 'Los datos del comercio no se pudieron verificar.';

    await servicio.rechazarSuscripcion(25, 3, { motivo });

    expect(avisos.planRechazado).toHaveBeenCalledWith(10, 25, motivo);
  });

  it('si la solicitud ya no esta pendiente no se avisa nada', async () => {
    solicitud.estado = EstadoSuscripcion.Activa;

    await expect(servicio.aprobarSuscripcion(25, 3)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      servicio.rechazarSuscripcion(25, 3, {
        motivo: 'Motivo suficientemente largo.',
      }),
    ).rejects.toThrow(ConflictException);

    expect(avisos.planAprobado).not.toHaveBeenCalled();
    expect(avisos.planRechazado).not.toHaveBeenCalled();
  });

  it('sin el servicio de avisos aprobar y rechazar funcionan igual', async () => {
    const sinAvisos = construir(false);

    await expect(sinAvisos.aprobarSuscripcion(25, 3)).resolves.toMatchObject({
      estado: EstadoSuscripcion.Activa,
    });
    solicitud.estado = EstadoSuscripcion.Solicitada;
    await expect(
      sinAvisos.rechazarSuscripcion(25, 3, {
        motivo: 'Motivo suficientemente largo.',
      }),
    ).resolves.toMatchObject({ estado: EstadoSuscripcion.Rechazada });
  });
});
