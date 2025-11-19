import WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { getConfig } from '../config/loader';
import { createLogger } from '../lib/logger';

export interface WebSocketEvent {
  type: 'upload:progress' | 'upload:complete' | 'upload:error' | 'job:status' | 'file:deleted' |
        'connection:established' | 'subscription:confirmed' | 'unsubscription:confirmed' |
        'authentication:success' | 'authentication:error' | 'pong';
  data: any;
  timestamp: string;
  eventId: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: Date;
}

export class WebSocketService {
  private wss?: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private logger: any;

  constructor() {
    this.logger = createLogger(getConfig());
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 10000);
  }

  public setupWSS(server?: any): void {
    if (this.wss) {
      return; // Already initialized
    }

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: new Date(),
      };

      this.clients.set(clientId, client);
      this.logger.info({ clientId, userAgent: req.headers['user-agent'] }, 'WebSocket client connected');

      ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(clientId, data.toString());
      });

      ws.on('close', (code: number, reason: string) => {
        this.clients.delete(clientId);
        this.logger.info({ clientId, code, reason }, 'WebSocket client disconnected');
      });

      ws.on('error', (error: Error) => {
        this.logger.error({ error, clientId }, 'WebSocket client error');
        this.clients.delete(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection:established',
        data: { clientId },
        timestamp: new Date().toISOString(),
        eventId: this.generateEventId(),
      });
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error({ error }, 'WebSocket server error');
    });
  }

  private performHeartbeat(): void {
    const now = new Date();
    const timeout = 30000; // 30 seconds

    for (const [clientId, client] of this.clients.entries()) {
      if (now.getTime() - client.lastPing.getTime() > timeout) {
        client.ws.terminate();
        this.clients.delete(clientId);
        
        this.logger.info({ clientId }, 'WebSocket client terminated due to timeout');
      }
    }
  }

  private handleMessage(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    
    if (!client) {
      return;
    }

    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data.channel);
          break;
        case 'authenticate':
          this.handleAuthentication(clientId, data.token);
          break;
        case 'ping':
          client.lastPing = new Date();
          this.sendToClient(clientId, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
            eventId: this.generateEventId(),
          });
          break;
        default:
          this.logger.warn({ clientId, messageType: data.type }, 'Unknown message type');
      }
    } catch (error) {
      this.logger.error({ clientId, message, error }, 'Failed to parse WebSocket message');
    }
  }

  private handleSubscription(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);
    
    this.sendToClient(clientId, {
      type: 'subscription:confirmed',
      data: { channel },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  private handleUnsubscription(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    
    this.sendToClient(clientId, {
      type: 'unsubscription:confirmed',
      data: { channel },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  private handleAuthentication(clientId: string, token: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // TODO: Implement proper JWT verification
    // For now, we'll just extract the userId from the token (placeholder)
    try {
      // This is a placeholder - implement proper JWT verification
      const userId = this.extractUserIdFromToken(token);
      client.userId = userId;
      
      this.sendToClient(clientId, {
        type: 'authentication:success',
        data: { userId },
        timestamp: new Date().toISOString(),
        eventId: this.generateEventId(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'authentication:error',
        data: { error: 'Invalid token' },
        timestamp: new Date().toISOString(),
        eventId: this.generateEventId(),
      });
    }
  }

  private extractUserIdFromToken(token: string): string {
    // Placeholder implementation - replace with proper JWT verification
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  public broadcast(event: WebSocketEvent, targetChannel?: string): void {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // If targetChannel is specified, only send to clients subscribed to that channel
        if (targetChannel && !client.subscriptions.has(targetChannel)) {
          continue;
        }

        // If the event is user-specific, only send to that user
        if (event.data.userId && client.userId !== event.data.userId) {
          continue;
        }

        this.sendToClient(clientId, event);
        sentCount++;
      }
    }

    this.logger.debug({ 
      eventType: event.type, 
      targetChannel, 
      sentCount, 
      totalClients: this.clients.size 
    }, 'WebSocket event broadcasted');
  }

  private sendToClient(clientId: string, event: WebSocketEvent): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(event));
    } catch (error) {
      this.logger.error({ clientId, error }, 'Failed to send WebSocket message');
    }
  }

  public uploadProgress(fileId: string, userId: string, progress: number, bytesUploaded?: number): void {
    this.broadcast({
      type: 'upload:progress',
      data: {
        fileId,
        userId,
        progress,
        bytesUploaded,
      },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  public uploadComplete(fileId: string, userId: string, fileData: any): void {
    this.broadcast({
      type: 'upload:complete',
      data: {
        fileId,
        userId,
        file: fileData,
      },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  public uploadError(fileId: string, userId: string, error: string): void {
    this.broadcast({
      type: 'upload:error',
      data: {
        fileId,
        userId,
        error,
      },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  public jobStatus(jobId: string, userId: string | undefined, status: string, progress?: number): void {
    this.broadcast({
      type: 'job:status',
      data: {
        jobId,
        userId,
        status,
        progress,
      },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  public fileDeleted(fileId: string, userId: string): void {
    this.broadcast({
      type: 'file:deleted',
      data: {
        fileId,
        userId,
      },
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
    });
  }

  private generateClientId(): string {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  private generateEventId(): string {
    return 'event_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  public getStats(): {
    connectedClients: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    
    for (const client of this.clients.values()) {
      totalSubscriptions += client.subscriptions.size;
    }

    return {
      connectedClients: this.clients.size,
      totalSubscriptions,
    };
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close();
    }

    if (this.wss) {
      this.wss.close();
    }
    
    this.logger.info('WebSocket service closed');
  }
}

export const webSocketService = new WebSocketService();