import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogosService } from '../Catalogos/catalogos.service';
import { InsigniasService } from '../Insignias/insignias.service';
import { MAX_FOTO_BYTES } from '../Nodos/imagen.util';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { RoleId } from '../Usuarios/roles.enum';
import { User } from '../Usuarios/user.entity';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { EstadoRuta } from './estado-ruta.enum';
import { RutaFavorita } from './ruta-favorita.entity';
import { RutaFoto } from './ruta-foto.entity';
import { Ruta } from './ruta.entity';
import { RutaService } from './ruta.service';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const DUENO: UsuarioAutenticado = {
  id: 7,
  email: 'ana@x.co',
  rol: RoleId.UserNormal,
};
const OTRO: UsuarioAutenticado = {
  id: 9,
  email: 'b@x.co',
  rol: RoleId.UserNormal,
};

const ruta = (parcial: Partial<Ruta> = {}): Ruta =>
  ({
    id: 5,
    nombre: 'Sendero',
    estado: EstadoRuta.Publicada,
    conFoto: false,
    creadoPor: { id: 7, idrol: RoleId.UserNormal } as User,
    ...parcial,
  }) as Ruta;

describe('RutaService — foto de la ruta', () => {
  let service: RutaService;
  const rutas = { findOne: jest.fn(), save: jest.fn() };
  const fotos = { save: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    rutas.save.mockImplementation((r: Ruta) => Promise.resolve(r));
    const modulo = await Test.createTestingModule({
      providers: [
        RutaService,
        { provide: getRepositoryToken(Ruta), useValue: rutas },
        { provide: getRepositoryToken(RutaFavorita), useValue: {} },
        { provide: getRepositoryToken(RutaFoto), useValue: fotos },
        { provide: NotificacionesService, useValue: {} },
        { provide: InsigniasService, useValue: {} },
        { provide: CatalogosService, useValue: {} },
      ],
    }).compile();
    service = modulo.get(RutaService);
  });

  describe('guardarFoto', () => {
    it('el dueno la guarda y la ruta queda con foto', async () => {
      rutas.findOne.mockResolvedValue(ruta());

      const guardada = await service.guardarFoto(5, PNG, DUENO);

      expect(fotos.save).toHaveBeenCalledWith({
        rutaId: 5,
        contenido: PNG,
        tipoMime: 'image/png',
      });
      expect(guardada.conFoto).toBe(true);
    });

    it('403 si la ruta es de otra persona', async () => {
      rutas.findOne.mockResolvedValue(ruta());

      await expect(service.guardarFoto(5, PNG, OTRO)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fotos.save).not.toHaveBeenCalled();
    });

    it('400 si no es una imagen (se mira el contenido, no el nombre)', async () => {
      rutas.findOne.mockResolvedValue(ruta());

      await expect(
        service.guardarFoto(5, Buffer.from('<html>no soy una imagen</html>'), DUENO),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('413 si pesa mas del tope', async () => {
      rutas.findOne.mockResolvedValue(ruta());

      await expect(
        service.guardarFoto(5, Buffer.alloc(MAX_FOTO_BYTES + 1), DUENO),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('404 si la ruta no existe', async () => {
      rutas.findOne.mockResolvedValue(null);

      await expect(service.guardarFoto(5, PNG, DUENO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('obtenerFoto', () => {
    it('una ruta publicada deja ver su foto a cualquiera', async () => {
      rutas.findOne.mockResolvedValue(ruta({ conFoto: true }));
      fotos.findOne.mockResolvedValue({ contenido: PNG, tipoMime: 'image/png' });

      await expect(service.obtenerFoto(5, OTRO)).resolves.toEqual({
        contenido: PNG,
        tipoMime: 'image/png',
      });
    });

    it('una ruta privada solo deja ver su foto al dueno: 404 al resto', async () => {
      rutas.findOne.mockResolvedValue(
        ruta({ estado: EstadoRuta.Privada, conFoto: true }),
      );
      fotos.findOne.mockResolvedValue({ contenido: PNG, tipoMime: 'image/png' });

      await expect(service.obtenerFoto(5, OTRO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.obtenerFoto(5, DUENO)).resolves.toBeDefined();
    });

    it('404 si la ruta no tiene foto', async () => {
      rutas.findOne.mockResolvedValue(ruta());
      fotos.findOne.mockResolvedValue(null);

      await expect(service.obtenerFoto(5, OTRO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
