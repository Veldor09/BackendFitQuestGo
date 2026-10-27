import { generateKeyPairSync, createVerify } from 'crypto';
import {
  crearProveedorPush,
  CuentaServicioFirebase,
  leerCuentaServicio,
  ProveedorPushFcm,
} from './proveedor-push-fcm';
import { ProveedorPushNulo } from './proveedor-push';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const cuenta: CuentaServicioFirebase = {
  project_id: 'fitquestgo-test',
  client_email: 'push@fitquestgo-test.iam.gserviceaccount.com',
  private_key: privateKey,
};

const mensaje = {
  token: 'token-del-telefono-xxxxxxxxxxxxxxxx',
  titulo: 'Titulo',
  cuerpo: 'Cuerpo',
  datos: { tipo: 'ruta_aprobada' },
  colapsarClave: 'ruta_aprobada:12',
};

const respuesta = (estado: number, cuerpo: unknown = {}) =>
  new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), {
    status: estado,
  });

describe('ProveedorPushFcm', () => {
  let llamadas: Array<{ url: string; init: RequestInit }>;
  let respuestasFcm: Response[];
  let hora: number;

  const crear = () =>
    new ProveedorPushFcm(
      cuenta,
      (url: string, init: RequestInit) => {
        llamadas.push({ url, init });
        if (url.includes('oauth2')) {
          return Promise.resolve(
            respuesta(200, { access_token: 'acceso-1', expires_in: 3600 }),
          );
        }
        return Promise.resolve(respuestasFcm.shift() ?? respuesta(200));
      },
      () => hora,
    );

  beforeEach(() => {
    llamadas = [];
    respuestasFcm = [];
    hora = 1_800_000_000_000;
  });

  it('pide el token de acceso con un JWT firmado RS256 y manda el mensaje', async () => {
    const resultado = await crear().enviar(mensaje);

    expect(resultado).toBe('enviado');
    const [oauth, fcm] = llamadas;
    expect(oauth.url).toBe('https://oauth2.googleapis.com/token');
    const asercion = new URLSearchParams(oauth.init.body as string).get(
      'assertion',
    )!;
    const [cabecera, carga, firma] = asercion.split('.');
    expect(JSON.parse(Buffer.from(cabecera, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(
      JSON.parse(Buffer.from(carga, 'base64url').toString()),
    ).toMatchObject({
      iss: cuenta.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
    });
    const verificador = createVerify('RSA-SHA256').update(
      `${cabecera}.${carga}`,
    );
    expect(verificador.verify(publicKey, Buffer.from(firma, 'base64url'))).toBe(
      true,
    );

    expect(fcm.url).toBe(
      'https://fcm.googleapis.com/v1/projects/fitquestgo-test/messages:send',
    );
    expect((fcm.init.headers as Record<string, string>).Authorization).toBe(
      'Bearer acceso-1',
    );
    const cuerpo = (JSON.parse(fcm.init.body as string) as { message: unknown })
      .message;
    expect(cuerpo).toMatchObject({
      token: mensaje.token,
      notification: { title: 'Titulo', body: 'Cuerpo' },
      data: { tipo: 'ruta_aprobada' },
      android: {
        priority: 'NORMAL',
        collapse_key: 'ruta_aprobada:12',
        notification: { tag: 'ruta_aprobada:12' },
      },
    });
  });

  it('reutiliza el token de acceso hasta un minuto antes de que venza', async () => {
    const proveedor = crear();
    await proveedor.enviar(mensaje);
    await proveedor.enviar(mensaje);
    expect(llamadas.filter((l) => l.url.includes('oauth2'))).toHaveLength(1);

    hora += 3600 * 1000 - 30_000; // faltan 30 s: toca renovar
    await proveedor.enviar(mensaje);
    expect(llamadas.filter((l) => l.url.includes('oauth2'))).toHaveLength(2);
  });

  it('404 / UNREGISTERED: el token ya no sirve', async () => {
    respuestasFcm = [
      respuesta(404, {
        error: { status: 'NOT_FOUND', message: 'UNREGISTERED' },
      }),
    ];
    await expect(crear().enviar(mensaje)).resolves.toBe('token_invalido');
  });

  it('400 INVALID_ARGUMENT sobre el token: tambien se olvida', async () => {
    respuestasFcm = [
      respuesta(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'The registration token is not valid',
        },
      }),
    ];
    await expect(crear().enviar(mensaje)).resolves.toBe('token_invalido');
  });

  it('un 400 que no habla del token es un error, no se borra el telefono', async () => {
    respuestasFcm = [
      respuesta(400, {
        error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload' },
      }),
    ];
    await expect(crear().enviar(mensaje)).resolves.toBe('error');
  });

  it('500 es un error pasajero', async () => {
    respuestasFcm = [respuesta(500, 'boom')];
    await expect(crear().enviar(mensaje)).resolves.toBe('error');
  });

  it('401 descarta el token de acceso para pedir otro la proxima vez', async () => {
    const proveedor = crear();
    respuestasFcm = [respuesta(401, 'expired')];
    await expect(proveedor.enviar(mensaje)).resolves.toBe('error');
    await proveedor.enviar(mensaje);
    expect(llamadas.filter((l) => l.url.includes('oauth2'))).toHaveLength(2);
  });

  it('si Google rechaza la cuenta de servicio devuelve error sin lanzar', async () => {
    const proveedor = new ProveedorPushFcm(cuenta, () =>
      Promise.resolve(respuesta(401, 'invalid_grant')),
    );
    await expect(proveedor.enviar(mensaje)).resolves.toBe('error');
  });

  it('si no hay red devuelve error sin lanzar', async () => {
    const proveedor = new ProveedorPushFcm(cuenta, () =>
      Promise.reject(new Error('ENOTFOUND')),
    );
    await expect(proveedor.enviar(mensaje)).resolves.toBe('error');
  });
});

describe('leerCuentaServicio / crearProveedorPush', () => {
  const json = JSON.stringify({
    project_id: 'p',
    client_email: 'e@p.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  });

  it('lee el JSON de la variable y arregla los saltos de linea escapados', () => {
    const lectura = leerCuentaServicio({ FIREBASE_SERVICE_ACCOUNT_JSON: json });
    expect(lectura?.project_id).toBe('p');
    expect(lectura?.private_key).toContain('\nabc\n');
  });

  it('tambien acepta el JSON en base64', () => {
    const base64 = Buffer.from(json).toString('base64');
    expect(
      leerCuentaServicio({ FIREBASE_SERVICE_ACCOUNT_BASE64: base64 })
        ?.client_email,
    ).toBe('e@p.iam.gserviceaccount.com');
  });

  it('sin variable, con basura o incompleta: null', () => {
    expect(leerCuentaServicio({})).toBeNull();
    expect(
      leerCuentaServicio({ FIREBASE_SERVICE_ACCOUNT_JSON: 'no es json' }),
    ).toBeNull();
    expect(
      leerCuentaServicio({
        FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"p"}',
      }),
    ).toBeNull();
  });

  it('sin cuenta (o mala) el proveedor es el nulo y la app sigue funcionando', async () => {
    const sinNada = crearProveedorPush({});
    expect(sinNada).toBeInstanceOf(ProveedorPushNulo);
    await expect(sinNada.enviar({} as never)).resolves.toBe('omitido');
    expect(
      crearProveedorPush({ FIREBASE_SERVICE_ACCOUNT_JSON: 'x' }),
    ).toBeInstanceOf(ProveedorPushNulo);
  });

  it('con cuenta valida el proveedor es el de Firebase', () => {
    expect(
      crearProveedorPush({ FIREBASE_SERVICE_ACCOUNT_JSON: json }),
    ).toBeInstanceOf(ProveedorPushFcm);
  });
});
