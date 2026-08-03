import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface EmailSendResult {
  delivered: boolean;
  mode: 'smtp' | 'demo';
}

const RESET_PASSWORD_ROUTE = '/reset-password';
const RESET_PASSWORD_SUBJECT = 'Réinitialisation de votre mot de passe — Terrasses de Baguida';

/**
 * Expéditeur d'emails générique (SMTP), indépendant du fournisseur :
 * le même service fonctionne avec n'importe quel relais SMTP (Resend,
 * Brevo, Mailgun, SMTP mutualisé, …) dès que `SMTP_HOST` est renseigné.
 *
 * Philosophie identique aux clients de paiement (Phase 0) : si SMTP n'est
 * pas configuré, on retombe en mode **démo** (le contenu est loggé hors
 * production) — le service ne lève jamais. En production sans SMTP, on
 * logge une erreur SANS le token ni le lien (sécurité : ne jamais exposer
 * un token de reset dans les logs).
 *
 * Module volontairement dédié (`common/email`) et sans queue BullMQ :
 * il est injecté directement par AuthService, sans dépendance à Redis.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  get isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private buildResetUrl(token: string): string {
    const baseUrl = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const normalized = baseUrl.replace(/\/+$/, '');
    return `${normalized}${RESET_PASSWORD_ROUTE}?token=${encodeURIComponent(token)}`;
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const options: SMTPTransport.Options = {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
      };
      if (process.env.SMTP_USER) {
        options.auth = {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ?? '',
        };
      }
      this.transporter = createTransport(options);
    }
    return this.transporter;
  }

  /**
   * Envoie l'email de réinitialisation de mot de passe contenant le lien
   * vers la page web `PUBLIC_WEB_URL/reset-password?token=...`.
   *
   * Le token n'est JAMAIS loggé : hors production le mode démo logge le
   * lien complet (comportement attendu pour le dev local), en production
   * la seule trace possible est une erreur sans le lien.
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<EmailSendResult> {
    const resetUrl = this.buildResetUrl(token);

    if (!this.isConfigured) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[email-demo] Lien de reset pour ${to} : ${resetUrl}`);
      } else {
        this.logger.error(`SMTP non configuré — lien de reset pour ${to} non envoyé.`);
      }
      return { delivered: false, mode: 'demo' };
    }

    const text =
      'Bonjour,\n\n' +
      'Vous avez demandé la réinitialisation de votre mot de passe.\n' +
      `Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :\n\n${resetUrl}\n\n` +
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n" +
      '— Terrasses de Baguida';

    const html =
      '<p>Bonjour,</p>\n' +
      '<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>\n' +
      `<p>Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :<br/>\n` +
      `<a href="${resetUrl}">${resetUrl}</a></p>\n` +
      "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>\n" +
      '<p>— Terrasses de Baguida</p>';

    await this.getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? 'no-reply@localhost',
      to,
      subject: RESET_PASSWORD_SUBJECT,
      text,
      html,
    });

    return { delivered: true, mode: 'smtp' };
  }
}
