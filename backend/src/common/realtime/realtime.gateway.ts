import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { verify } from 'jsonwebtoken';

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

    this.server.use((socket, next) => {
      const authToken =
        (typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined) ??
        (typeof socket.handshake.headers.authorization === 'string' ? socket.handshake.headers.authorization : undefined);

      if (!authToken) {
        return next();
      }

      const token = authToken.startsWith('Bearer ') ? authToken.slice(7).trim() : authToken.trim();
      const accessSecret = this.config.get<string>('jwt.accessSecret', 'replace-me');

      try {
        const payload = verify(token, accessSecret) as { sub?: string; role?: string };
        if (payload?.sub) {
          socket.data.user = { id: payload.sub, role: payload.role ?? null };
        }
      } catch {
        // Keep public socket connected for non-sensitive channels.
      }

      next();
    });

    this.server.on('connection', (socket) => {
      socket.join('public');
      const user = socket.data.user as { id?: string; role?: string } | undefined;
      if (user?.id) {
        socket.join('authenticated');
        socket.join(`user:${user.id}`);
        if (user.role) {
          socket.join(`role:${user.role}`);
        }
      }
    });
  }

  emitEvent(channel: string, payload: unknown) {
    if (!this.server) return;
    this.server.to('authenticated').emit(channel, payload);
  }

  emitToPublic(channel: string, payload: unknown) {
    if (!this.server) return;
    this.server.to('public').emit(channel, payload);
  }

  emitToUser(userId: string, channel: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(channel, payload);
  }

  emitToRoles(roles: string[], channel: string, payload: unknown) {
    if (!this.server) return;
    roles.forEach((role) => this.server.to(`role:${role}`).emit(channel, payload));
  }
}
