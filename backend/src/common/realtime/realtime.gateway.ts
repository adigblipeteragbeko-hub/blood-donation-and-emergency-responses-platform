import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly config: ConfigService) {}

  afterInit() {
    const origins = this.config.get<string[]>('cors.origins', []);
    this.logger.log(`Realtime gateway initialized for origins: ${origins.join(', ') || 'all'}`);
  }

  emitEvent(channel: string, payload: unknown) {
    this.server.emit(channel, payload);
  }
}
