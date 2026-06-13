// WebSocket client for JARVIS real-time communication
import { JarvisEvent } from "./types";

type EventHandler = (event: JarvisEvent) => void;

export class JarvisWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private reconnectDelay = 2000;
  private url: string;
  public onStatusChange?: (connected: boolean) => void;

  constructor(sessionId: string, baseUrl?: string, gender = "sir") {
    this.sessionId = sessionId;
    const finalBaseUrl = baseUrl || (typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000") : "ws://localhost:8000");
    this.url = `${finalBaseUrl}/ws/${sessionId}?gender=${gender}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onStatusChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: JarvisEvent = JSON.parse(event.data);
            this._dispatch(data.type, data);
            this._dispatch("*", data); // wildcard
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket connection error:", error);
          reject(new Error(`Failed to connect to Neural Link at ${this.url}. Ensure the backend server is running on port 8000.`));
        };

        this.ws.onclose = () => {
          this.onStatusChange?.(false);
          this._dispatch("disconnected" as any, {
            type: "disconnected" as any,
            timestamp: new Date().toISOString(),
          });
          this._tryReconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  send(type: string | { type: string; data?: any }, payload: Record<string, unknown> = {}): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (typeof type === "object") {
        this.ws.send(JSON.stringify(type));
      } else {
        this.ws.send(JSON.stringify({ type, ...payload }));
      }
    }
  }

  sendMessage(content: string, userId = "default_user"): void {
    this.send("message", { content, user_id: userId });
  }

  ping(): void {
    this.send("ping");
  }

  clearSession(): void {
    this.send("clear");
  }

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    // Return unsubscribe fn
    return () => {
      const arr = this.handlers.get(eventType) || [];
      const idx = arr.indexOf(handler);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  off(eventType: string, handler: EventHandler): void {
    const arr = this.handlers.get(eventType) || [];
    const idx = arr.indexOf(handler);
    if (idx !== -1) arr.splice(idx, 1);
  }

  disconnect(): void {
    this.maxReconnects = 0; // disable reconnect
    this.ws?.close();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _dispatch(type: string, event: JarvisEvent): void {
    (this.handlers.get(type) || []).forEach((h) => {
      try {
        h(event);
      } catch (e) {
        console.error("Handler error:", e);
      }
    });
  }

  private _tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnects) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect().catch(console.error), delay);
  }
}
