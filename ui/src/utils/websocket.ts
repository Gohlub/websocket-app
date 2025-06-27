// WebSocket utilities for real-time collaboration

import type { WSMessage } from '../types/editor';

export type WSMessageHandler = (message: WSMessage) => void;

export class EditorWebSocket {
  private ws: WebSocket | null = null;
  private messageHandler: WSMessageHandler | null = null;
  private reconnectTimer: number | null = null;
  private documentId: string | null = null;
  
  constructor() {}
  
  connect(onMessage: WSMessageHandler): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to the WebSocket endpoint
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.ws = new WebSocket(`${protocol}//${host}/ws`);
        
        this.messageHandler = onMessage;
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;
            if (this.messageHandler) {
              this.messageHandler(message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      if (this.messageHandler) {
        this.connect(this.messageHandler).then(() => {
          // Rejoin document if we were in one
          if (this.documentId) {
            this.joinDocument(this.documentId);
          }
        }).catch(console.error);
      }
    }, 3000);
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.messageHandler = null;
    this.documentId = null;
  }
  
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  send(message: WSMessage): void {
    if (this.isConnected() && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }
  
  // Document operations
  joinDocument(documentId: string) {
    this.documentId = documentId;
    this.send({ type: 'JoinDocument', document_id: documentId });
  }
  
  leaveDocument(documentId: string) {
    this.documentId = null;
    this.send({ type: 'LeaveDocument', document_id: documentId });
  }
  
  sendTextChange(position: number, deleteCount: number, insert: string) {
    this.send({
      type: 'TextChange',
      position,
      delete: deleteCount,
      insert,
    });
  }
  
  sendCursorMove(position: number) {
    this.send({
      type: 'CursorMove',
      position,
    });
  }
}