import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendEmail(options: { to: string; subject: string; text: string; html?: string }) {
    const host = this.config.get<string>('smtp.host', '');
    const port = this.config.get<number>('smtp.port', 587);
    const user = this.config.get<string>('smtp.user', '');
    const pass = this.config.get<string>('smtp.pass', '');
    const from = this.config.get<string>('smtp.from', user || 'no-reply@bloodresponse.local');

    if (!host || !user || !pass) {
      this.logger.error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
      throw new InternalServerErrorException('Email delivery is not configured');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
