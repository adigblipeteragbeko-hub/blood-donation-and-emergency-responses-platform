import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsMessageType = 'emergency_request' | 'appointment_reminder' | 'donor_approval' | 'donation_confirmation' | 'system';

export type SmsSendOptions = {
  to: string;
  message: string;
  type?: SmsMessageType;
  metadata?: Record<string, unknown>;
};

export type SmsSendResult = {
  delivered: boolean;
  provider: string;
  skippedReason?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    const provider = this.config.get<string>('sms.provider', 'console');
    const enabled = this.config.get<boolean>('sms.enabled', false);

    if (!enabled) {
      this.logger.log(
        `SMS disabled locally. Would send ${options.type ?? 'system'} SMS to ${this.maskPhone(options.to)} via ${provider}.`,
      );
      return {
        delivered: false,
        provider,
        skippedReason: 'SMS is disabled. Set SMS_ENABLED=true and provider credentials to enable delivery.',
      };
    }

    if (provider === 'twilio') {
      return this.sendViaTwilio(options);
    }

    if (provider === 'africas_talking') {
      return this.sendViaAfricasTalking(options);
    }

    this.logger.log(`[SMS console provider] ${this.maskPhone(options.to)}: ${options.message}`);
    return { delivered: true, provider: 'console' };
  }

  private async sendViaTwilio(options: SmsSendOptions): Promise<SmsSendResult> {
    const accountSid = this.config.get<string>('sms.twilioAccountSid', '');
    const authToken = this.config.get<string>('sms.twilioAuthToken', '');
    const from = this.config.get<string>('sms.twilioFromNumber', '');

    if (!accountSid || !authToken || !from) {
      this.logger.warn('Twilio SMS requested, but credentials are incomplete.');
      return {
        delivered: false,
        provider: 'twilio',
        skippedReason: 'Twilio credentials are incomplete.',
      };
    }

    this.logger.log(`Twilio SMS structure ready for ${this.maskPhone(options.to)}. Install the Twilio SDK before enabling live sends.`);
    return {
      delivered: false,
      provider: 'twilio',
      skippedReason: 'Twilio SDK is not installed in local mode; structure is prepared for production integration.',
    };
  }

  private async sendViaAfricasTalking(options: SmsSendOptions): Promise<SmsSendResult> {
    const username = this.config.get<string>('sms.africasTalkingUsername', '');
    const apiKey = this.config.get<string>('sms.africasTalkingApiKey', '');
    const from = this.config.get<string>('sms.from', 'BloodResponse');

    if (!username || !apiKey || !from) {
      this.logger.warn("Africa's Talking SMS requested, but credentials are incomplete.");
      return {
        delivered: false,
        provider: 'africas_talking',
        skippedReason: "Africa's Talking credentials are incomplete.",
      };
    }

    this.logger.log(
      `Africa's Talking SMS structure ready for ${this.maskPhone(options.to)}. Install the provider SDK before enabling live sends.`,
    );
    return {
      delivered: false,
      provider: 'africas_talking',
      skippedReason: "Africa's Talking SDK is not installed in local mode; structure is prepared for production integration.",
    };
  }

  private maskPhone(phone: string) {
    if (phone.length <= 4) return phone;
    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  }
}
