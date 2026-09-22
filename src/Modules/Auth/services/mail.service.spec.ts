import { Test, TestingModule } from '@nestjs/testing';
import { AuthConfig } from '../auth.config';
import { MailService } from './mail.service';

const sendMailMock = jest.fn().mockResolvedValue(undefined);
const createTransportMock = jest
  .fn()
  .mockReturnValue({ sendMail: sendMailMock });

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => createTransportMock(...args),
}));

describe('MailService', () => {
  let service: MailService;
  let config: {
    gmailUser: string | undefined;
    gmailAppPassword: string | undefined;
  };

  beforeEach(async () => {
    sendMailMock.mockClear();
    createTransportMock.mockClear();
    config = { gmailUser: 'bot@gmail.com', gmailAppPassword: 'clave-app' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService, { provide: AuthConfig, useValue: config }],
    }).compile();

    service = module.get(MailService);
  });

  it('lanza si no hay GMAIL_USER/GMAIL_APP_PASSWORD configurados', async () => {
    config.gmailUser = undefined;
    await expect(
      service.enviarCodigoRecuperacion('user@x.co', '123456'),
    ).rejects.toThrow(/GMAIL_USER|GMAIL_APP_PASSWORD/);
  });

  it('envia el correo con el codigo cuando esta configurado', async () => {
    await service.enviarCodigoRecuperacion('user@x.co', '123456');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const llamada = sendMailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
    };
    expect(llamada.to).toBe('user@x.co');
    expect(llamada.text).toContain('123456');
  });
});
