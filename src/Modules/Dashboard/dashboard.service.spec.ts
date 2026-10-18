import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DashboardService } from './dashboard.service';
import { User } from '../Usuarios/user.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { Alerta } from '../Alertas/alerta.entity';
import { ReporteContenido } from '../ReportesContenido/reporte-contenido.entity';

import { EstadoRuta } from '../Rutas/estado-ruta.enum';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { EstadoAlerta } from '../Alertas/estado-alerta.enum';
import { EstadoReporteContenido } from '../ReportesContenido/estado-reporte-contenido.enum';

describe('DashboardService', () => {
  let service: DashboardService;

  const usuariosRepository = { count: jest.fn() };
  const rutasRepository = { count: jest.fn() };
  const nodosRepository = { count: jest.fn() };
  const alertasRepository = { count: jest.fn() };
  const reportesRepository = { count: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(User),
          useValue: usuariosRepository,
        },
        {
          provide: getRepositoryToken(Ruta),
          useValue: rutasRepository,
        },
        {
          provide: getRepositoryToken(Nodo),
          useValue: nodosRepository,
        },
        {
          provide: getRepositoryToken(Alerta),
          useValue: alertasRepository,
        },
        {
          provide: getRepositoryToken(ReporteContenido),
          useValue: reportesRepository,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('debe calcular correctamente los indicadores y las colas', async () => {
    usuariosRepository.count.mockResolvedValue(120);

    rutasRepository.count
      .mockResolvedValueOnce(45)
      .mockResolvedValueOnce(8);

    alertasRepository.count.mockResolvedValue(3);
    nodosRepository.count.mockResolvedValue(5);
    reportesRepository.count.mockResolvedValue(4);

    const resultado = await service.obtenerResumen();

    expect(resultado).toEqual({
      usuarios: 120,
      rutas: 45,
      alertasActivas: 3,
      pendientes: 17,
      colas: {
        rutasPorRevisar: 8,
        nodosPendientes: 5,
        reportesNuevos: 4,
      },
    });

    expect(rutasRepository.count).toHaveBeenCalledWith({
      where: { estado: EstadoRuta.Pendiente },
    });

    expect(nodosRepository.count).toHaveBeenCalledWith({
      where: { estado: EstadoNodo.Pendiente },
    });

    expect(reportesRepository.count).toHaveBeenCalledWith({
      where: { estado: EstadoReporteContenido.Pendiente },
    });

    expect(alertasRepository.count).toHaveBeenCalledWith({
      where: {
        estado: EstadoAlerta.Activa,
        expiraEn: expect.objectContaining({
          _type: 'moreThan',
        }),
      },
    });
  });

  it('debe devolver cero cuando no existen registros', async () => {
    usuariosRepository.count.mockResolvedValue(0);
    rutasRepository.count.mockResolvedValue(0);
    nodosRepository.count.mockResolvedValue(0);
    alertasRepository.count.mockResolvedValue(0);
    reportesRepository.count.mockResolvedValue(0);

    const resultado = await service.obtenerResumen();

    expect(resultado).toEqual({
      usuarios: 0,
      rutas: 0,
      alertasActivas: 0,
      pendientes: 0,
      colas: {
        rutasPorRevisar: 0,
        nodosPendientes: 0,
        reportesNuevos: 0,
      },
    });
  });

  it('debe consultar los cinco repositorios', async () => {
    usuariosRepository.count.mockResolvedValue(1);
    rutasRepository.count.mockResolvedValue(1);
    nodosRepository.count.mockResolvedValue(1);
    alertasRepository.count.mockResolvedValue(1);
    reportesRepository.count.mockResolvedValue(1);

    await service.obtenerResumen();

    expect(usuariosRepository.count).toHaveBeenCalledTimes(1);
    expect(rutasRepository.count).toHaveBeenCalledTimes(2);
    expect(nodosRepository.count).toHaveBeenCalledTimes(1);
    expect(alertasRepository.count).toHaveBeenCalledTimes(1);
    expect(reportesRepository.count).toHaveBeenCalledTimes(1);
  });
});