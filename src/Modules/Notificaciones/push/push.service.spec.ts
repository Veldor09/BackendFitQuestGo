import { Repository } from 'typeorm';
import { User } from '../../Usuarios/user.entity';
import { DispositivoPush } from './dispositivo-push.entity';
import { TipoPush } from './push-plantillas';
import { MensajePush, ProveedorPush, ResultadoPush } from './proveedor-push';
import { PushService } from './push.service';

class ServicioConReloj extends PushService {
  hora = 1_000_000;
  protected ahora(): number {
    return this.hora;
  }
}

describe('PushService', () => {
  let dispositivos: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let usuarios: { findOne: jest.Mock };
  let enviados: MensajePush[];
  let resultado: ResultadoPush;
  let enviar: jest.Mock;
  let proveedor: ProveedorPush;
  let servicio: ServicioConReloj;

  const notificacion = {
    id: 50,
    idUsuario: 7,
    categoria: 'rutas',
    referenciaTipo: 'ruta',
    referenciaId: 12,
  };
  const solicitud = {
    tipo: TipoPush.RutaAprobada,
    params: { nombre: 'Sendero Norte' },
  };
  const telefono = (id: number, idioma = 'es') => ({
    id,
    usuarioId: 7,
    token: `token-del-telefono-${id}-xxxxxxxxxx`,
    idioma,
  });

  beforeEach(() => {
    dispositivos = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([telefono(1)]),
      save: jest.fn().mockImplementation((x: unknown) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x: unknown) => x),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    usuarios = {
      findOne: jest.fn().mockResolvedValue({ id: 7, notificaciones: true }),
    };
    enviados = [];
    resultado = 'enviado';
    enviar = jest.fn();
    proveedor = {
      enviar: enviar.mockImplementation((m: MensajePush) => {
        enviados.push(m);
        return Promise.resolve(resultado);
      }),
    };
    servicio = new ServicioConReloj(
      dispositivos as unknown as Repository<DispositivoPush>,
      usuarios as unknown as Repository<User>,
      proveedor,
    );
  });

  describe('registrar / quitar', () => {
    const dto = {
      token: 'token-nuevo-xxxxxxxxxxxxxxxxxxxx',
      plataforma: 'android' as const,
      idioma: 'en',
    };

    it('guarda un telefono nuevo con su idioma', async () => {
      await expect(servicio.registrar(7, dto)).resolves.toEqual({
        registrado: true,
      });
      expect(dispositivos.create).toHaveBeenCalledWith({
        usuarioId: 7,
        token: dto.token,
        plataforma: 'android',
        idioma: 'en',
      });
      expect(dispositivos.save).toHaveBeenCalledTimes(1);
    });

    it('si el mismo telefono entra con otra cuenta, el token pasa a la cuenta nueva', async () => {
      const fila = {
        id: 3,
        usuarioId: 1,
        token: dto.token,
        plataforma: 'android',
        idioma: 'es',
      };
      dispositivos.findOne.mockResolvedValue(fila);

      await servicio.registrar(7, dto);

      expect(dispositivos.create).not.toHaveBeenCalled();
      expect(fila.usuarioId).toBe(7);
      expect(fila.idioma).toBe('en');
      expect(dispositivos.save).toHaveBeenCalledWith(fila);
    });

    it('un idioma raro se guarda como español', async () => {
      await servicio.registrar(7, { ...dto, idioma: 'xx' });
      expect(dispositivos.create).toHaveBeenCalledWith(
        expect.objectContaining({ idioma: 'es' }),
      );
    });

    it('quitar borra solo el telefono de ese usuario', async () => {
      await servicio.quitar(7, dto.token);
      expect(dispositivos.delete).toHaveBeenCalledWith({
        usuarioId: 7,
        token: dto.token,
      });
    });
  });

  describe('notificar', () => {
    it('manda el aviso al telefono, en su idioma y con los datos para abrir la app', async () => {
      dispositivos.find.mockResolvedValue([telefono(1, 'en')]);

      await servicio.notificar(notificacion, solicitud);

      expect(enviados).toHaveLength(1);
      expect(enviados[0]).toMatchObject({
        token: telefono(1).token,
        titulo: 'Your route was approved!',
        datos: {
          tipo: 'ruta_aprobada',
          categoria: 'rutas',
          notificacionId: '50',
          referenciaTipo: 'ruta',
          referenciaId: '12',
        },
        colapsarClave: 'ruta_aprobada:12',
      });
    });

    it('cada telefono recibe el aviso en su propio idioma', async () => {
      dispositivos.find.mockResolvedValue([
        telefono(1, 'es'),
        telefono(2, 'pt'),
      ]);

      await servicio.notificar(notificacion, solicitud);

      expect(enviados.map((m) => m.titulo)).toEqual([
        '¡Tu ruta fue aprobada!',
        'Sua rota foi aprovada!',
      ]);
    });

    it('no manda nada si la persona apago "Notificaciones push"', async () => {
      usuarios.findOne.mockResolvedValue({ id: 7, notificaciones: false });

      await servicio.notificar(notificacion, solicitud);

      expect(enviar).not.toHaveBeenCalled();
      expect(dispositivos.find).not.toHaveBeenCalled();
    });

    it('no manda nada si no hay telefonos registrados', async () => {
      dispositivos.find.mockResolvedValue([]);
      await servicio.notificar(notificacion, solicitud);
      expect(enviar).not.toHaveBeenCalled();
    });

    it('olvida el telefono cuyo token Firebase dice que ya no existe', async () => {
      resultado = 'token_invalido';
      await servicio.notificar(notificacion, solicitud);
      expect(dispositivos.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('un fallo del proveedor no lanza ni borra el telefono', async () => {
      enviar.mockRejectedValue(new Error('sin red'));

      await expect(
        servicio.notificar(notificacion, solicitud),
      ).resolves.toBeUndefined();
      expect(dispositivos.delete).not.toHaveBeenCalled();
    });

    it('maximo 5 avisos por persona por hora; pasada la hora vuelve a mandar', async () => {
      for (let i = 0; i < PushService.MAXIMO_POR_HORA + 3; i++) {
        await servicio.notificar(notificacion, solicitud);
      }
      expect(enviados).toHaveLength(PushService.MAXIMO_POR_HORA);

      servicio.hora += 61 * 60 * 1000;
      await servicio.notificar(notificacion, solicitud);
      expect(enviados).toHaveLength(PushService.MAXIMO_POR_HORA + 1);
    });

    it('lo que no salio (proveedor omitido o con error) no gasta el cupo', async () => {
      resultado = 'omitido';
      for (let i = 0; i < 10; i++) {
        await servicio.notificar(notificacion, solicitud);
      }
      resultado = 'enviado';
      enviados.length = 0;

      await servicio.notificar(notificacion, solicitud);
      expect(enviados).toHaveLength(1);
    });

    it('el cupo es por persona: otra no se ve afectada', async () => {
      for (let i = 0; i < PushService.MAXIMO_POR_HORA; i++) {
        await servicio.notificar(notificacion, solicitud);
      }
      usuarios.findOne.mockResolvedValue({ id: 8, notificaciones: true });
      dispositivos.find.mockResolvedValue([{ ...telefono(9), usuarioId: 8 }]);
      enviados.length = 0;

      await servicio.notificar({ ...notificacion, idUsuario: 8 }, solicitud);

      expect(enviados).toHaveLength(1);
    });
  });
});
