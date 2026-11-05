import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../Auditoria/auditoria.service';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { audienciaParaRol, metodoPagoParaPais, pagoDisponible } from './pago';
import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { EstadoSuscripcion, Suscripcion } from './suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';

describe('pago.ts', () => {
  it('Costa Rica paga por ONVO; el resto del mundo con PayPal (aun no disponible)', () => {
    expect(metodoPagoParaPais('CR')).toBe('onvo');
    expect(metodoPagoParaPais(' cr ')).toBe('onvo');
    expect(metodoPagoParaPais('US')).toBe('paypal');
    expect(metodoPagoParaPais(undefined)).toBe('paypal');
    expect(pagoDisponible('onvo')).toBe(true);
    expect(pagoDisponible('paypal')).toBe(false);
  });

  it('las empresas ven planes de empresa y todos los demas, de usuario', () => {
    expect(audienciaParaRol(2)).toBe('empresa');
    expect(audienciaParaRol(1)).toBe('usuario');
    expect(audienciaParaRol(3)).toBe('usuario');
  });
});

describe('SuscripcionesService - pago en linea, audiencia y gestion', () => {
  let planes: { find: jest.Mock; findOne: jest.Mock };
  let precios: { find: jest.Mock; findOne: jest.Mock };
  let suscripciones: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let servicio: SuscripcionesService;
  let pasarela: {
    disponible: boolean;
    crearSesion: jest.Mock;
    obtenerSesion: jest.Mock;
  };
  let usuarios: { findOne: jest.Mock };
  let repoTx: { findOne: jest.Mock; save: jest.Mock };
  let avisos: { planAprobado: jest.Mock };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };

  const planUsuario = {
    id: 2,
    nombre: 'Plan Explorador',
    duracionDias: 30,
    activo: true,
    audiencia: 'usuario',
  };

  beforeEach(() => {
    planes = {
      find: jest.fn().mockResolvedValue([planUsuario]),
      findOne: jest.fn().mockResolvedValue(planUsuario),
    };
    precios = {
      find: jest
        .fn()
        .mockResolvedValue([
          { planId: 2, moneda: 'CRC', importe: '2500.00', activo: true },
        ]),
      findOne: jest.fn().mockResolvedValue({ importe: '2500.00' }),
    };
    suscripciones = {
      // 1a llamada: numero libre?; 2a: ya tiene solicitud?
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((x: object) => x),
      save: jest
        .fn()
        .mockImplementation((x: object) =>
          Promise.resolve({ id: 7, creadoEn: new Date('2026-10-29'), ...x }),
        ),
      createQueryBuilder: jest.fn(),
    };
    pasarela = {
      disponible: true,
      crearSesion: jest.fn().mockResolvedValue({
        id: 'cs_1',
        url: 'https://checkout.onvopay.com/pay/cs_1',
      }),
      obtenerSesion: jest.fn(),
    };
    usuarios = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        nombreUser: 'Ana Mora',
        emailUser: 'ana@example.com',
      }),
    };
    repoTx = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((x: object) => Promise.resolve(x)),
    };
    avisos = { planAprobado: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      getRepository: jest
        .fn()
        .mockImplementation((entidad: { name: string }) =>
          entidad.name === 'User' ? usuarios : repoTx,
        ),
      transaction: jest
        .fn()
        .mockImplementation((op: (m: unknown) => unknown) =>
          Promise.resolve(op({ getRepository: () => repoTx })),
        ),
    };
    servicio = new SuscripcionesService(
      planes as unknown as Repository<PlanPatrocinio>,
      precios as unknown as Repository<PrecioPatrocinio>,
      suscripciones as unknown as Repository<Suscripcion>,
      {} as Repository<RenovacionSuscripcion>,
      {} as AuditoriaService,
      dataSource as unknown as DataSource,
      avisos as unknown as PatrocinioAvisosService,
      pasarela,
    );
  });

  describe('consultarPlanes', () => {
    it('filtra por audiencia cuando se la dan', async () => {
      await servicio.consultarPlanes('CR', 'usuario');
      expect(planes.find).toHaveBeenCalledWith({
        where: { activo: true, audiencia: 'usuario' },
        order: { id: 'ASC' },
      });
    });

    it('en Costa Rica dice que se paga por ONVO y que ya se puede', async () => {
      const r = await servicio.consultarPlanes('CR', 'usuario');
      expect(r).toMatchObject({ metodoPago: 'onvo', pagoDisponible: true });
      expect(r).not.toHaveProperty('sinpeNumero');
    });

    it('en Costa Rica sin llaves de ONVO el pago aun no esta disponible', async () => {
      pasarela.disponible = false;
      const r = await servicio.consultarPlanes('CR', 'usuario');
      expect(r).toMatchObject({ metodoPago: 'onvo', pagoDisponible: false });
    });

    it('fuera de Costa Rica muestra los planes pero avisa que el pago aun no esta disponible', async () => {
      precios.find.mockResolvedValue([
        { planId: 2, moneda: 'USD', importe: '5.00', activo: true },
      ]);
      const r = await servicio.consultarPlanes('US', 'usuario');
      expect(r).toMatchObject({
        moneda: 'USD',
        metodoPago: 'paypal',
        pagoDisponible: false,
      });
      expect(r.planes).toHaveLength(1);
    });
  });

  describe('iniciarPago', () => {
    const dto = { planId: 2, pais: 'CR' };
    const urls = {
      retorno: (id: number) =>
        `http://api.test/patrocinio/pagos/retorno?s=${id}`,
      cancelado: 'http://api.test/patrocinio/pagos/cancelado',
    };

    it('crea la solicitud y la sesion de pago con el monto del plan (no del cliente)', async () => {
      const r = await servicio.iniciarPago(10, dto, 1, urls);

      expect(r.numeroSolicitud).toMatch(/^[1-9]\d{5}$/);
      expect(r).toEqual({
        suscripcionId: 7,
        numeroSolicitud: r.numeroSolicitud,
        url: 'https://checkout.onvopay.com/pay/cs_1',
      });
      expect(pasarela.crearSesion).toHaveBeenCalledWith(
        expect.objectContaining({
          monto: 2500,
          moneda: 'CRC',
          clienteNombre: 'Ana Mora',
          clienteEmail: 'ana@example.com',
          redirectUrl: 'http://api.test/patrocinio/pagos/retorno?s=7',
          cancelUrl: 'http://api.test/patrocinio/pagos/cancelado',
          metadata: expect.objectContaining({
            suscripcionId: '7',
          }) as Record<string, string>,
        }),
      );
      // La referencia de la sesion queda guardada en la solicitud.
      expect(suscripciones.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 7,
          estado: 'Solicitada',
          pagoRef: 'cs_1',
        }),
      );
    });

    it('si el numero ya lo tiene otra solicitud, saca otro', async () => {
      let numerosProbados = 0;
      suscripciones.findOne.mockImplementation(
        (opciones: { where: { numeroSolicitud?: string } }) => {
          if (opciones.where.numeroSolicitud === undefined)
            return Promise.resolve(null);
          numerosProbados++;
          return Promise.resolve(numerosProbados === 1 ? { id: 1 } : null);
        },
      );

      const r = await servicio.iniciarPago(10, dto, 1, urls);

      expect(r.numeroSolicitud).toMatch(/^\d{6}$/);
      expect(numerosProbados).toBe(2);
    });

    it('un usuario no puede pedir un plan de empresa (403 PLAN_NO_APLICA)', async () => {
      planes.findOne.mockResolvedValue({
        ...planUsuario,
        audiencia: 'empresa',
      });

      await expect(
        servicio.iniciarPago(10, dto, 1, urls),
      ).rejects.toMatchObject({ status: 403, message: 'PLAN_NO_APLICA' });
      expect(pasarela.crearSesion).not.toHaveBeenCalled();
    });

    it('una empresa no puede pedir un plan de usuario', async () => {
      await expect(
        servicio.iniciarPago(20, dto, 2, urls),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('fuera de Costa Rica no se puede pagar todavia (400 PAGO_NO_DISPONIBLE)', async () => {
      await expect(
        servicio.iniciarPago(10, { planId: 2, pais: 'US' }, 1, urls),
      ).rejects.toMatchObject({ status: 400, message: 'PAGO_NO_DISPONIBLE' });
      expect(pasarela.crearSesion).not.toHaveBeenCalled();
    });

    it('sin llaves de ONVO tampoco se puede (400 PAGO_NO_DISPONIBLE)', async () => {
      pasarela.disponible = false;
      await expect(
        servicio.iniciarPago(10, dto, 1, urls),
      ).rejects.toMatchObject({ status: 400, message: 'PAGO_NO_DISPONIBLE' });
    });

    it('con un plan activo da 409 y no cobra', async () => {
      suscripciones.findOne.mockImplementation(
        (opciones: { where: { estado?: string } }) =>
          Promise.resolve(
            opciones.where.estado === EstadoSuscripcion.Activa
              ? { id: 99, venceEn: new Date(Date.now() + 86400000) }
              : null,
          ),
      );
      await expect(
        servicio.iniciarPago(10, dto, 1, urls),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(pasarela.crearSesion).not.toHaveBeenCalled();
    });

    it('una solicitud manual en revision (sin pago en linea) sigue dando 409', async () => {
      suscripciones.findOne.mockImplementation(
        (opciones: { where: { estado?: string } }) =>
          Promise.resolve(
            opciones.where.estado === EstadoSuscripcion.Solicitada
              ? { id: 99, estado: 'Solicitada', pagoRef: null }
              : null,
          ),
      );
      await expect(
        servicio.iniciarPago(10, dto, 1, urls),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    describe('un pago en linea anterior sin completar', () => {
      const abandonada = () => ({
        id: 5,
        usuarioId: 10,
        planId: 2,
        estado: EstadoSuscripcion.Solicitada,
        pagoRef: 'cs_viejo',
        moneda: 'CRC',
        precioAplicado: '2500.00',
      });

      beforeEach(() => {
        suscripciones.findOne.mockImplementation(
          (opciones: { where: { estado?: string; id?: number } }) =>
            Promise.resolve(
              opciones.where.estado === EstadoSuscripcion.Solicitada ||
                opciones.where.id === 5
                ? abandonada()
                : null,
            ),
        );
        repoTx.findOne.mockImplementation(() => Promise.resolve(abandonada()));
        pasarela.obtenerSesion.mockResolvedValue({
          id: 'cs_viejo',
          pagada: false,
          expirada: false,
          metadata: {},
        });
      });

      it('se pregunta a ONVO y, si no se pago, se cierra y deja pagar de nuevo', async () => {
        const r = await servicio.iniciarPago(10, dto, 1, urls);

        expect(pasarela.obtenerSesion).toHaveBeenCalledWith('cs_viejo');
        expect(repoTx.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 5, estado: 'Rechazada' }),
        );
        expect(r.url).toBe('https://checkout.onvopay.com/pay/cs_1');
      });

      it('si ONVO dice que SI se pago, se activa y no se cobra otra vez (409)', async () => {
        pasarela.obtenerSesion.mockResolvedValue({
          id: 'cs_viejo',
          pagada: true,
          expirada: false,
          metadata: {},
        });

        await expect(
          servicio.iniciarPago(10, dto, 1, urls),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(repoTx.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 5, estado: 'Activa' }),
        );
        expect(repoTx.save).not.toHaveBeenCalledWith(
          expect.objectContaining({ estado: 'Rechazada' }),
        );
        expect(pasarela.crearSesion).not.toHaveBeenCalled();
      });

      it('si justo se activo mientras tanto, cerrarla no la pisa', async () => {
        // confirmarPago no la ve pagada, pero al cerrar ya esta activa (carrera).
        repoTx.findOne.mockResolvedValue({
          ...abandonada(),
          estado: EstadoSuscripcion.Activa,
        });

        await servicio.iniciarPago(10, dto, 1, urls);

        expect(repoTx.save).not.toHaveBeenCalledWith(
          expect.objectContaining({ estado: 'Rechazada' }),
        );
      });

      it('si no se puede preguntar a ONVO, no se cierra nada y sube un 503', async () => {
        pasarela.obtenerSesion.mockRejectedValue(
          new Error('ONVO respondio 500'),
        );

        await expect(
          servicio.iniciarPago(10, dto, 1, urls),
        ).rejects.toMatchObject({ status: 503 });
        expect(repoTx.save).not.toHaveBeenCalled();
        expect(pasarela.crearSesion).not.toHaveBeenCalled();
      });
    });

    it('un plan que ya vencio (sigue Activa con la fecha pasada) se marca Vencida y deja renovar', async () => {
      const vencida = {
        id: 99,
        estado: EstadoSuscripcion.Activa,
        venceEn: new Date(Date.now() - 86400000),
      };
      suscripciones.findOne.mockImplementation(
        (opciones: { where: { estado?: string } }) =>
          Promise.resolve(
            opciones.where.estado === EstadoSuscripcion.Activa ? vencida : null,
          ),
      );

      const r = await servicio.iniciarPago(10, dto, 1, urls);

      expect(vencida.estado).toBe('Vencida');
      expect(suscripciones.save).toHaveBeenCalledWith(vencida);
      expect(r.url).toBe('https://checkout.onvopay.com/pay/cs_1');
    });

    it('guarda el precio al crear la solicitud: es el que se cobra', async () => {
      await servicio.iniciarPago(10, dto, 1, urls);

      expect(suscripciones.create).toHaveBeenCalledWith(
        expect.objectContaining({ precioAplicado: '2500.00' }),
      );
    });

    it('si ONVO falla, la solicitud nueva se cierra y sube un 503', async () => {
      pasarela.crearSesion.mockRejectedValue(new Error('ONVO respondio 500'));

      await expect(
        servicio.iniciarPago(10, dto, 1, urls),
      ).rejects.toMatchObject({ status: 503 });
      expect(suscripciones.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 7, estado: 'Rechazada' }),
      );
    });
  });

  describe('miSuscripcion confirma un pago en linea en curso', () => {
    const enCurso = () => ({
      id: 7,
      usuarioId: 10,
      planId: 2,
      estado: EstadoSuscripcion.Solicitada,
      pagoRef: 'cs_1',
      numeroSolicitud: '482913',
      pais: 'CR',
      moneda: 'CRC',
      precioAplicado: '2500.00',
      iniciaEn: null,
      venceEn: null,
      pagadaEn: null,
      creadoEn: new Date('2026-11-04'),
    });

    it('si ONVO ya lo marco pagado, la consulta lo activa y lo devuelve activo (sin esperar al webhook)', async () => {
      let activada = false;
      suscripciones.findOne.mockImplementation(() =>
        Promise.resolve(
          activada
            ? {
                ...enCurso(),
                estado: EstadoSuscripcion.Activa,
                iniciaEn: new Date(),
                venceEn: new Date(Date.now() + 30 * 86400000),
              }
            : enCurso(),
        ),
      );
      repoTx.findOne.mockImplementation(() => Promise.resolve(enCurso()));
      repoTx.save.mockImplementation((x: { estado?: string }) => {
        if (x.estado === 'Activa') activada = true;
        return Promise.resolve(x);
      });
      pasarela.obtenerSesion.mockResolvedValue({
        id: 'cs_1',
        pagada: true,
        expirada: false,
        metadata: {},
      });

      const r = await servicio.miSuscripcion(10);

      expect(r).toMatchObject({ estado: 'Activa', vigente: true });
      expect(avisos.planAprobado).toHaveBeenCalledTimes(1);
    });

    it('si todavia no se pago, sigue Solicitada y no consulta de mas', async () => {
      suscripciones.findOne.mockResolvedValue(enCurso());
      pasarela.obtenerSesion.mockResolvedValue({
        id: 'cs_1',
        pagada: false,
        expirada: false,
        metadata: {},
      });

      const r = await servicio.miSuscripcion(10);

      expect(r).toMatchObject({ estado: 'Solicitada', pagoEnLinea: true });
      expect(repoTx.save).not.toHaveBeenCalled();
    });

    it('si ONVO no responde, devuelve lo que hay en vez de fallar', async () => {
      suscripciones.findOne.mockResolvedValue(enCurso());
      pasarela.obtenerSesion.mockRejectedValue(new Error('ONVO respondio 500'));

      await expect(servicio.miSuscripcion(10)).resolves.toMatchObject({
        estado: 'Solicitada',
      });
    });

    it('una suscripcion que no es un pago en curso no consulta a ONVO', async () => {
      suscripciones.findOne.mockResolvedValue({
        ...enCurso(),
        estado: EstadoSuscripcion.Activa,
        venceEn: new Date(Date.now() + 86400000),
      });

      await servicio.miSuscripcion(10);

      expect(pasarela.obtenerSesion).not.toHaveBeenCalled();
    });
  });

  describe('confirmarPago', () => {
    const solicitada = () => ({
      id: 7,
      usuarioId: 10,
      planId: 2,
      estado: EstadoSuscripcion.Solicitada,
      pagoRef: 'cs_1',
      moneda: 'CRC',
      precioAplicado: '2500.00',
      iniciaEn: null,
      venceEn: null,
      pagadaEn: null,
    });
    const pagada = {
      id: 'cs_1',
      pagada: true,
      expirada: false,
      metadata: {},
    };

    beforeEach(() => {
      suscripciones.findOne.mockResolvedValue(solicitada());
      repoTx.findOne.mockImplementation(() => Promise.resolve(solicitada()));
      precios.findOne.mockResolvedValue({ importe: '2500.00' });
      pasarela.obtenerSesion.mockResolvedValue(pagada);
    });

    it('si ONVO dice que se pago, activa 30 dias, guarda el precio y avisa', async () => {
      const antes = Date.now();
      await expect(servicio.confirmarPago(7)).resolves.toBe('activada');

      expect(pasarela.obtenerSesion).toHaveBeenCalledWith('cs_1');
      const guardada = (repoTx.save.mock.calls as [Suscripcion][])[0][0];
      expect(guardada).toMatchObject({
        estado: 'Activa',
        precioAplicado: '2500.00',
        administradorId: null,
      });
      expect(guardada.iniciaEn!.getTime()).toBeGreaterThanOrEqual(antes);
      expect(guardada.pagadaEn).toBeInstanceOf(Date);
      expect(
        Math.round(
          (guardada.venceEn!.getTime() - guardada.iniciaEn!.getTime()) /
            86400000,
        ),
      ).toBe(30);
      expect(avisos.planAprobado).toHaveBeenCalledWith(10, 7, 30, 'usuario');
    });

    it('el precio registrado es el de la solicitud aunque el plan haya cambiado despues', async () => {
      precios.findOne.mockResolvedValue({ importe: '9999.00' });

      await servicio.confirmarPago(7);

      expect(repoTx.save).toHaveBeenCalledWith(
        expect.objectContaining({ precioAplicado: '2500.00' }),
      );
    });

    it('si todavia no se pago no cambia nada', async () => {
      pasarela.obtenerSesion.mockResolvedValue({ ...pagada, pagada: false });

      await expect(servicio.confirmarPago(7)).resolves.toBe('pendiente');
      expect(repoTx.save).not.toHaveBeenCalled();
      expect(avisos.planAprobado).not.toHaveBeenCalled();
    });

    it('confirmarla otra vez (retorno + webhook) no activa ni avisa dos veces', async () => {
      suscripciones.findOne.mockResolvedValue({
        ...solicitada(),
        estado: EstadoSuscripcion.Activa,
      });

      await expect(servicio.confirmarPago(7)).resolves.toBe('ya_activa');
      expect(pasarela.obtenerSesion).not.toHaveBeenCalled();
      expect(avisos.planAprobado).not.toHaveBeenCalled();
    });

    it('si otra llamada la activo justo antes (carrera), tampoco avisa de nuevo', async () => {
      repoTx.findOne.mockResolvedValue({
        ...solicitada(),
        estado: EstadoSuscripcion.Activa,
      });

      await expect(servicio.confirmarPago(7)).resolves.toBe('ya_activa');
      expect(repoTx.save).not.toHaveBeenCalled();
      expect(avisos.planAprobado).not.toHaveBeenCalled();
    });

    it('una solicitud inexistente, o manual sin pago en linea, no se confirma', async () => {
      suscripciones.findOne.mockResolvedValue(null);
      await expect(servicio.confirmarPago(7)).resolves.toBe('no_encontrada');

      suscripciones.findOne.mockResolvedValue({
        ...solicitada(),
        pagoRef: null,
      });
      await expect(servicio.confirmarPago(7)).resolves.toBe('no_encontrada');
      expect(pasarela.obtenerSesion).not.toHaveBeenCalled();
    });

    it('una solicitud ya cerrada (rechazada) no se activa aunque ONVO diga pagado', async () => {
      suscripciones.findOne.mockResolvedValue({
        ...solicitada(),
        estado: EstadoSuscripcion.Rechazada,
      });

      await expect(servicio.confirmarPago(7)).resolves.toBe('pendiente');
      expect(repoTx.save).not.toHaveBeenCalled();
    });

    it('confirmarPorSesion busca la solicitud por la referencia del pago', async () => {
      await servicio.confirmarPorSesion('cs_1');

      expect(suscripciones.findOne).toHaveBeenCalledWith({
        where: { pagoRef: 'cs_1' },
      });
      expect(repoTx.save).toHaveBeenCalled();
    });
  });

  describe('listarSuscripciones (admin)', () => {
    const armarConsulta = () => {
      const q: Record<string, jest.Mock> = {};
      for (const m of [
        'innerJoin',
        'leftJoin',
        'select',
        'orderBy',
        'addOrderBy',
        'limit',
        'andWhere',
      ]) {
        q[m] = jest.fn().mockReturnValue(q);
      }
      q.getRawMany = jest.fn().mockResolvedValue([{ id: 1 }]);
      suscripciones.createQueryBuilder.mockReturnValue(q);
      return q;
    };

    it('sin filtros trae las mas recientes', async () => {
      const q = armarConsulta();
      await expect(servicio.listarSuscripciones()).resolves.toEqual([
        { id: 1 },
      ]);
      expect(q.andWhere).not.toHaveBeenCalled();
      expect(q.limit).toHaveBeenCalledWith(200);
    });

    it('incluye la referencia del pago en linea', async () => {
      const q = armarConsulta();
      await servicio.listarSuscripciones();
      expect(q.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          's.pagoRef AS "pagoRef"',
          's.pagadaEn AS "pagadaEn"',
        ]),
      );
    });

    it('filtra por estado y busca por numero, nombre o correo', async () => {
      const q = armarConsulta();
      await servicio.listarSuscripciones({
        estado: 'Solicitada',
        q: ' 123456 ',
      });

      expect(q.andWhere).toHaveBeenCalledWith('s.estado = :estado', {
        estado: 'Solicitada',
      });
      expect(q.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('s.numeroSolicitud = :exacto'),
        { exacto: '123456', parcial: '%123456%' },
      );
    });
  });

  describe('suspenderSuscripcion', () => {
    let avisos: { planSuspendido: jest.Mock };
    let repoTx: { findOne: jest.Mock; save: jest.Mock };
    let auditoria: { registrar: jest.Mock };

    beforeEach(() => {
      avisos = { planSuspendido: jest.fn().mockResolvedValue(undefined) };
      auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      repoTx = {
        findOne: jest.fn().mockResolvedValue({
          id: 5,
          usuarioId: 10,
          planId: 2,
          estado: EstadoSuscripcion.Activa,
        }),
        save: jest.fn().mockImplementation((x: object) => Promise.resolve(x)),
      };
      servicio = new SuscripcionesService(
        planes as unknown as Repository<PlanPatrocinio>,
        precios as unknown as Repository<PrecioPatrocinio>,
        suscripciones as unknown as Repository<Suscripcion>,
        {} as Repository<RenovacionSuscripcion>,
        auditoria as unknown as AuditoriaService,
        {
          transaction: jest
            .fn()
            .mockImplementation((op: (m: unknown) => unknown) =>
              Promise.resolve(op({ getRepository: () => repoTx })),
            ),
        } as unknown as DataSource,
        avisos as unknown as PatrocinioAvisosService,
      );
    });

    it('pasa una activa a suspendida, lo deja en auditoria y avisa al dueno', async () => {
      const r = await servicio.suspenderSuscripcion(5, 3);

      expect(r).toMatchObject({ id: 5, estado: 'Suspendida' });
      expect(repoTx.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'Suspendida', administradorId: 3 }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'SUSPENDER_SUSCRIPCION',
          entidadId: 5,
        }),
        expect.anything(),
      );
      expect(avisos.planSuspendido).toHaveBeenCalledWith(10, 5);
    });

    it('solo se suspenden las activas', async () => {
      repoTx.findOne.mockResolvedValue({
        id: 5,
        usuarioId: 10,
        estado: EstadoSuscripcion.Solicitada,
      });
      await expect(servicio.suspenderSuscripcion(5, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(avisos.planSuspendido).not.toHaveBeenCalled();
    });

    it('una suscripcion inexistente da 404', async () => {
      repoTx.findOne.mockResolvedValue(null);
      await expect(servicio.suspenderSuscripcion(5, 3)).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
