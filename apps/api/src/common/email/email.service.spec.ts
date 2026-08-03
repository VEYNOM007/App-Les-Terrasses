import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const createTransportMock = createTransport as jest.Mock;

/**
 * Tests unitaires — EmailService (remise des tokens de reset, R6 AuthModule)
 *
 * Couvre :
 *   1. Mode démo (SMTP non configuré, hors production) : aucune tentative
 *      d'envoi, résultat `{ delivered: false, mode: 'demo' }`.
 *   2. Mode démo en production : erreur loggée SANS le token ni le lien
 *      (sécurité : jamais exposer un token de reset dans les logs).
 *   3. SMTP configuré : transporter créé avec les bons paramètres et
 *      sendMail appelé avec from/to/sujet + lien de reset contenant le token.
 */
describe('EmailService', () => {
  let service: EmailService;

  const previousEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM',
      'PUBLIC_WEB_URL',
    ].forEach((key) => {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    });
  });

  afterAll(() => {
    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService();
  });

  describe('mode demo (SMTP non configure)', () => {
    it("hors production : ne tente aucun envoi et retourne { delivered: false, mode: 'demo' }", async () => {
      process.env.NODE_ENV = 'test';

      const result = await service.sendPasswordResetEmail('kofi@test.tg', 'token-demo');

      expect(result).toEqual({ delivered: false, mode: 'demo' });
      expect(createTransport).not.toHaveBeenCalled();
    });

    it('en production : logge une erreur SANS le token ni le lien', async () => {
      process.env.NODE_ENV = 'production';
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await service.sendPasswordResetEmail('kofi@test.tg', 'token-secret');

      expect(result).toEqual({ delivered: false, mode: 'demo' });
      const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('SMTP non configuré');
      expect(logged).not.toContain('token-secret');
      expect(logged).not.toContain('http');
      errorSpy.mockRestore();
    });
  });

  describe('mode SMTP configure', () => {
    it("envoie l'email avec le lien de reset et retourne { delivered: true, mode: 'smtp' }", async () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_USER = 'apikey';
      process.env.SMTP_PASS = 'secret';
      process.env.SMTP_FROM = 'no-reply@example.tg';
      process.env.PUBLIC_WEB_URL = 'https://app.example.tg/';

      const sendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
      createTransportMock.mockReturnValue({ sendMail });

      const result = await service.sendPasswordResetEmail('kofi@test.tg', 'raw-token-123');

      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: 'secret' },
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const [mail] = sendMail.mock.calls[0];
      expect(mail).toMatchObject({
        from: 'no-reply@example.tg',
        to: 'kofi@test.tg',
        subject: 'Réinitialisation de votre mot de passe — Terrasses de Baguida',
      });
      expect(mail.text).toContain('https://app.example.tg/reset-password?token=raw-token-123');
      expect(mail.html).toContain('https://app.example.tg/reset-password?token=raw-token-123');
      expect(result).toEqual({ delivered: true, mode: 'smtp' });
    });

    it('trailing slash de PUBLIC_WEB_URL : le lien reste propre', async () => {
      process.env.NODE_ENV = 'test';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.PUBLIC_WEB_URL = 'https://app.example.tg///';

      const sendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
      createTransportMock.mockReturnValue({ sendMail });

      await service.sendPasswordResetEmail('kofi@test.tg', 'tok');

      const [mail] = sendMail.mock.calls[0];
      expect(mail.text).toContain('https://app.example.tg/reset-password?token=tok');
      expect(mail.text).not.toContain('///');
    });
  });
});
