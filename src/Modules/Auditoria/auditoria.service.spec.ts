
import { BadRequestException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { RegistroAuditoria } from './registro-auditoria.entity';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let query: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(() => {
    query = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    repository = {
      create: jest.fn((datos) => datos),
      save: jest.fn(async (datos) => ({ id: 1, ...datos })),
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };

    service = new AuditoriaService(
      repository as unknown as import('typeorm').Repository<RegistroAuditoria>,
    );
  });

  it('registra una accion administrativa', async () => {
    const resultado = await service.registrar({
      administradorId: 1,
      accion: 'USUARIO_CREADO',
      entidad: 'USUARIO',
      entidadId: 25,
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(resultado).toMatchObject({
      administradorId: 1,
      accion: 'USUARIO_CREADO',
      entidadId: 25,
    });
  });

  it('aplica filtros y paginacion', async () => {
    await service.consultar({
      administradorId: 1,
      accion: 'USUARIO_CREADO',
      entidad: 'USUARIO',
      pagina: 2,
      limite: 10,
    });

    expect(query.andWhere).toHaveBeenCalledTimes(3);
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.take).toHaveBeenCalledWith(10);
    expect(query.orderBy).toHaveBeenCalledWith(
      'auditoria.creadoEn',
      'DESC',
    );
  });

  it('rechaza un rango de fechas invertido', async () => {
    await expect(
      service.consultar({
        fechaDesde: '2026-10-22',
        fechaHasta: '2026-10-20',
        pagina: 1,
        limite: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('devuelve el total y las paginas calculadas', async () => {
    query.getManyAndCount.mockResolvedValue([[], 45]);

    const resultado = await service.consultar({
      pagina: 2,
      limite: 20,
    });

    expect(resultado.total).toBe(45);
    expect(resultado.totalPaginas).toBe(3);
    expect(resultado.pagina).toBe(2);
  });
});
