
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { CrearInsigniaDto } from './dto/administrar-insignia.dto';
import { TipoInsignia } from './insignia.enum';
import { Insignia, MetricaInsignia } from './insignia.entity';
import { InsigniasService } from './insignias.service';
import { UsuarioInsignia } from './usuario-insignia.entity';

describe('InsigniasService - Administración ADM-10', () => {
  let service: InsigniasService;
  let insigniaRepo: jest.Mocked<Repository<Insignia>>;

  const crearInsignia = (
    cambios: Partial<Insignia> = {},
  ): Insignia => ({
    id: 1,
    codigo: 'RUTAS_5',
    nombre: 'Cinco rutas',
    descripcion: 'Completa cinco rutas',
    emoji: '🏅',
    tipo: TipoInsignia.Hito,
    metrica: MetricaInsignia.Rutas,
    meta: 5,
    activa: true,
    usuariosInsignias: [],
    ...cambios,
  });

  const crearDto = (
    cambios: Partial<CrearInsigniaDto> = {},
  ): CrearInsigniaDto => ({
    codigo: 'RUTAS_5',
    nombre: 'Cinco rutas',
    descripcion: 'Completa cinco rutas',
    emoji: '🏅',
    tipo: TipoInsignia.Hito,
    metrica: MetricaInsignia.Rutas,
    meta: 5,
    activa: true,
    ...cambios,
  });

  beforeEach(async () => {
    const mockInsigniaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          InsigniasService,
          {
            provide: getRepositoryToken(Insignia),
            useValue: mockInsigniaRepo,
          },
          {
            provide: getRepositoryToken(UsuarioInsignia),
            useValue: {},
          },
          {
            provide: NotificacionesService,
            useValue: {},
          },
        ],
      }).compile();

    service = module.get<InsigniasService>(InsigniasService);
    insigniaRepo = module.get(getRepositoryToken(Insignia));

    insigniaRepo.find.mockResolvedValue([]);
    insigniaRepo.findOne.mockResolvedValue(null);

    insigniaRepo.create.mockImplementation(
      (datos) => datos as Insignia,
    );

    insigniaRepo.save.mockImplementation(
      async (insignia) => insignia as Insignia,
    );
  });

  describe('Listado y consulta', () => {
    it('debe listar insignias activas e inactivas', async () => {
      const insignias = [
        crearInsignia(),
        crearInsignia({
          id: 2,
          codigo: 'RUTAS_10',
          activa: false,
        }),
      ];

      insigniaRepo.find.mockResolvedValue(insignias);

      const resultado = await service.listarAdministracion();

      expect(resultado).toEqual(insignias);
      expect(insigniaRepo.find).toHaveBeenCalledWith({
        order: { id: 'ASC' },
      });
    });

    it('debe consultar una insignia por ID', async () => {
      const insignia = crearInsignia();

      insigniaRepo.findOne.mockResolvedValue(insignia);

      const resultado = await service.obtenerAdministracion(1);

      expect(resultado).toEqual(insignia);
      expect(insigniaRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('debe rechazar un identificador inválido', async () => {
      await expect(
        service.obtenerAdministracion(0),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.obtenerAdministracion(-1),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.obtenerAdministracion(1.5),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(insigniaRepo.findOne).not.toHaveBeenCalled();
    });

    it('debe informar cuando la insignia no existe', async () => {
      await expect(
        service.obtenerAdministracion(999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Creación', () => {
    it('debe crear una insignia correctamente', async () => {
      const resultado = await service.crearAdministracion(
        crearDto(),
      );

      expect(insigniaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo: 'RUTAS_5',
          nombre: 'Cinco rutas',
          metrica: MetricaInsignia.Rutas,
          meta: 5,
          activa: true,
        }),
      );

      expect(insigniaRepo.save).toHaveBeenCalledTimes(1);
      expect(resultado.codigo).toBe('RUTAS_5');
    });

    it('debe normalizar el código y limpiar los textos', async () => {
      await service.crearAdministracion(
        crearDto({
          codigo: ' rutas_5 ',
          nombre: ' Cinco rutas ',
          descripcion: ' Completa cinco rutas ',
          emoji: ' 🏅 ',
        }),
      );

      expect(insigniaRepo.findOne).toHaveBeenCalledWith({
        where: { codigo: 'RUTAS_5' },
      });

      expect(insigniaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo: 'RUTAS_5',
          nombre: 'Cinco rutas',
          descripcion: 'Completa cinco rutas',
          emoji: '🏅',
        }),
      );
    });

    it('debe activar por defecto una insignia nueva', async () => {
      await service.crearAdministracion(
        crearDto({ activa: undefined }),
      );

      expect(insigniaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ activa: true }),
      );
    });

    it('debe permitir crear una insignia inactiva', async () => {
      await service.crearAdministracion(
        crearDto({ activa: false }),
      );

      expect(insigniaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ activa: false }),
      );
    });

    it('debe rechazar códigos duplicados', async () => {
      insigniaRepo.findOne.mockResolvedValue(crearInsignia());

      await expect(
        service.crearAdministracion(crearDto()),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(insigniaRepo.save).not.toHaveBeenCalled();
    });

    it('debe manejar una colisión de código en PostgreSQL', async () => {
      insigniaRepo.save.mockRejectedValue({
        driverError: { code: '23505' },
      });

      await expect(
        service.crearAdministracion(crearDto()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('debe aceptar una meta decimal válida', async () => {
      await service.crearAdministracion(
        crearDto({
          codigo: 'KM_1_01',
          tipo: TipoInsignia.Km,
          metrica: MetricaInsignia.Km,
          meta: 1.01,
        }),
      );

      expect(insigniaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('debe rechazar metas inválidas', async () => {
      for (const meta of [0, -1, 1.001, 100000000]) {
        await expect(
          service.crearAdministracion(
            crearDto({ meta }),
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      expect(insigniaRepo.save).not.toHaveBeenCalled();
    });

    it('debe exigir métrica km para insignias de tipo km', async () => {
      await expect(
        service.crearAdministracion(
          crearDto({
            tipo: TipoInsignia.Km,
            metrica: MetricaInsignia.Rutas,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Edición', () => {
    it('debe actualizar el nombre y la descripción', async () => {
      const insignia = crearInsignia();

      insigniaRepo.findOne.mockResolvedValue(insignia);

      const resultado = await service.editarAdministracion(1, {
        nombre: 'Explorador',
        descripcion: 'Completa nuevas rutas',
      });

      expect(resultado.nombre).toBe('Explorador');
      expect(resultado.descripcion).toBe(
        'Completa nuevas rutas',
      );
      expect(resultado.codigo).toBe('RUTAS_5');
      expect(insigniaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('debe desactivar una insignia sin eliminarla', async () => {
      insigniaRepo.findOne.mockResolvedValue(
        crearInsignia(),
      );

      const resultado = await service.editarAdministracion(1, {
        activa: false,
      });

      expect(resultado.activa).toBe(false);
      expect(insigniaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('debe reactivar una insignia', async () => {
      insigniaRepo.findOne.mockResolvedValue(
        crearInsignia({ activa: false }),
      );

      const resultado = await service.editarAdministracion(1, {
        activa: true,
      });

      expect(resultado.activa).toBe(true);
    });

    it('debe aceptar metas numéricas recuperadas como texto', async () => {
      const insignia = crearInsignia();

      // PostgreSQL puede devolver numeric como string.
      Object.assign(insignia, { meta: '12.50' });

      insigniaRepo.findOne.mockResolvedValue(insignia);

      const resultado = await service.editarAdministracion(1, {
        activa: false,
      });

      expect(resultado.activa).toBe(false);
      expect(insigniaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('debe permitir editar una insignia especial sin meta', async () => {
      insigniaRepo.findOne.mockResolvedValue(
        crearInsignia({
          codigo: 'ESPECIAL_MADRUGADOR',
          metrica: MetricaInsignia.Especial,
          meta: null,
          activa: false,
        }),
      );

      const resultado = await service.editarAdministracion(1, {
        nombre: 'Madrugador',
      });

      expect(resultado.nombre).toBe('Madrugador');
      expect(resultado.meta).toBeNull();
    });

    it('debe rechazar configuraciones incompatibles', async () => {
      insigniaRepo.findOne.mockResolvedValue(
        crearInsignia(),
      );

      await expect(
        service.editarAdministracion(1, {
          tipo: TipoInsignia.Km,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(insigniaRepo.save).not.toHaveBeenCalled();
    });


    it('debe rechazar tipo km con métrica especial y meta nula', async () => {
      insigniaRepo.findOne.mockResolvedValue(
        crearInsignia({
          codigo: 'ESPECIAL_KM',
          tipo: TipoInsignia.Km,
          metrica: MetricaInsignia.Especial,
          meta: null,
        }),
      );

      await expect(
        service.editarAdministracion(1, {
          nombre: 'Insignia incompatible',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(insigniaRepo.save).not.toHaveBeenCalled();
    });
    it('debe rechazar la edición de una insignia inexistente', async () => {
      await expect(
        service.editarAdministracion(999, {
          nombre: 'No existe',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(insigniaRepo.save).not.toHaveBeenCalled();
    });
  });
});
