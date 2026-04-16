import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  notifyCritical(event: string, payload: Record<string, unknown>) {
    this.logger.error(JSON.stringify({ level: 'CRITICAL', event, payload }));
  }

  notifySecurity(event: string, payload: Record<string, unknown>) {
    this.logger.warn(JSON.stringify({ level: 'SECURITY', event, payload }));
  }
}
