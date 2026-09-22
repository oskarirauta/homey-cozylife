import net from 'net';
import { EventEmitter } from 'events';

export interface CozyLifeDeviceInfo {
  did: string;
  pid: string;
  dtp?: string;
  mac?: string;
  ip?: string;
  sv?: string;
  hv?: string;
  modelName?: string;
}

export interface CozyLifeMessage {
  cmd: number;
  pv: number;
  sn: string;
  res?: number;
  msg?: any;
}

export const CMD_INFO = 0;
export const CMD_QUERY = 2;
export const CMD_SET = 3;
export const CMD_PUSH = 10;

/**
 * Check if a gang (0-indexed) is ON according to bitmask.
 * Gang 0 = bit 0 (mask 1)
 * Gang 1 = bit 1 (mask 2)
 * Gang 2 = bit 2 (mask 4)
 * Gang 3 = bit 3 (mask 8)
 */
export function isGangOn(bitmask: number, gangIndex: number): boolean {
  return (bitmask & (1 << gangIndex)) !== 0;
}

/**
 * Calculate the new bitmask when toggling a specific gang.
 */
export function calcNewBitmask(currentBitmask: number, gangIndex: number, turnOn: boolean): number {
  if (turnOn) {
    return currentBitmask | (1 << gangIndex);
  }
  return currentBitmask & ~(1 << gangIndex);
}

/**
 * Extract relay bitmask from CozyLife data payload.
 * In CozyLife switches, data['1'] is the integer bitmask representing all gangs.
 * (e.g., 1 = Gang 1, 2 = Gang 2, 3 = Gang 1+2, 4 = Gang 3, etc.)
 */
export function parseBitmaskFromData(
  data: Record<string, any>,
  currentBitmask: number
): { bitmask: number; hasChange: boolean } {
  if (data && typeof data === 'object' && typeof data['1'] !== 'undefined') {
    const bitmask = Number(data['1']);
    if (!isNaN(bitmask) && bitmask >= 0) {
      return { bitmask, hasChange: bitmask !== currentBitmask };
    }
  }
  return { bitmask: currentBitmask, hasChange: false };
}

export class CozyLifeClient extends EventEmitter {
  public ip: string;
  public port: number;
  public currentBitmask = 0;
  public isConnected = false;

  private hasReceivedInitialState = false;
  private socket: net.Socket | null = null;
  private buffer = '';
  private pendingRequests = new Map<string, {
    resolve: (res: CozyLifeMessage) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private logger: (...args: any[]) => void;

  constructor(ip: string, port = 5555, logger?: (...args: any[]) => void) {
    super();
    this.ip = ip;
    this.port = port;
    this.logger = logger || console.log.bind(console);
  }

  /**
   * Connect to the CozyLife device via TCP.
   */
  public async connect(): Promise<void> {
    this.destroyed = false;
    if (this.socket && !this.socket.destroyed && this.isConnected) {
      return;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      this.socket = socket;

      let hasResolved = false;

      const connectTimeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          socket.destroy();
          reject(new Error(`Connection to ${this.ip}:${this.port} timed out`));
        }
      }, 5000);

      socket.connect(this.port, this.ip, () => {
        clearTimeout(connectTimeout);
        this.isConnected = true;
        this.buffer = '';
        this.logger(`[CozyLifeClient] Connected to ${this.ip}:${this.port}`);
        this.emit('connected');

        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }

        // Query initial state upon connection
        this.queryState().catch((err) => {
          this.logger(`[CozyLifeClient] Initial queryState failed:`, err.message);
        });
      });

      socket.on('data', (chunk: Buffer) => {
        this.handleData(chunk);
      });

      socket.on('error', (err: Error) => {
        this.logger(`[CozyLifeClient] Socket error on ${this.ip}:`, err.message);
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(connectTimeout);
          reject(err);
        }
      });

      socket.on('close', () => {
        this.isConnected = false;
        this.socket = null;
        this.logger(`[CozyLifeClient] Connection closed for ${this.ip}`);
        this.emit('disconnected');
        this.rejectAllPending(new Error('Connection closed'));

        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      });
    });
  }

  /**
   * Close connection and prevent auto-reconnect.
   */
  public disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new Error('Client disconnected'));
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Schedule automatic reconnection.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) {
        this.logger(`[CozyLifeClient] Attempting to reconnect to ${this.ip}...`);
        this.connect().catch((err) => {
          this.logger(`[CozyLifeClient] Reconnect failed for ${this.ip}:`, err.message);
        });
      }
    }, 8000);
  }

  /**
   * Process incoming TCP data stream with line buffer.
   */
  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message: CozyLifeMessage = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch (err: any) {
        this.logger(`[CozyLifeClient] Failed to parse JSON: "${trimmed}" -`, err.message);
      }
    }
  }

  /**
   * Dispatch parsed message.
   */
  private handleMessage(message: CozyLifeMessage): void {
    // Check if message updates switch data
    if (message.msg && message.msg.data && typeof message.msg.data === 'object') {
      const { bitmask, hasChange } = parseBitmaskFromData(message.msg.data, this.currentBitmask);
      this.currentBitmask = bitmask;

      this.logger(
        `[CozyLifeClient] Device ${this.ip} update: data=${JSON.stringify(message.msg.data)}, bitmask=${bitmask} (binary: ${bitmask.toString(2)}), hasChange=${hasChange}`
      );

      if (hasChange || !this.hasReceivedInitialState) {
        this.hasReceivedInitialState = true;
        this.emit('state', bitmask);
      }
    }

    // Resolve any pending request waiting for this sn
    if (message.sn && this.pendingRequests.has(message.sn)) {
      const pending = this.pendingRequests.get(message.sn)!;
      this.pendingRequests.delete(message.sn);
      clearTimeout(pending.timer);
      pending.resolve(message);
    }
  }

  /**
   * Send a JSON command to the device and await matching response.
   */
  public async sendRequest(payload: { cmd: number; pv?: number; sn?: string; msg: any }, timeoutMs = 4000): Promise<CozyLifeMessage> {
    if (!this.socket || !this.isConnected) {
      await this.connect();
    }

    if (!payload.sn) {
      payload.sn = String(Date.now());
    }
    if (typeof payload.pv === 'undefined') {
      payload.pv = 0;
    }

    const sn = payload.sn;
    const packet = JSON.stringify(payload) + '\r\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(sn);
        reject(new Error(`Request sn=${sn} to ${this.ip} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(sn, { resolve, reject, timer });

      try {
        this.socket!.write(packet, 'utf8', (err) => {
          if (err) {
            clearTimeout(timer);
            this.pendingRequests.delete(sn);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(sn);
        reject(err);
      }
    });
  }

  /**
   * Query device information (CMD 0).
   */
  public async queryDeviceInfo(): Promise<CozyLifeDeviceInfo> {
    const res = await this.sendRequest({
      cmd: CMD_INFO,
      msg: {}
    });

    if (!res.msg || !res.msg.did) {
      throw new Error('Device did not return a valid did');
    }

    return {
      did: res.msg.did,
      pid: res.msg.pid || '',
      dtp: res.msg.dtp,
      mac: res.msg.mac,
      ip: res.msg.ip || this.ip,
      sv: res.msg.sv,
      hv: res.msg.hv
    };
  }

  /**
   * Query current relay states (CMD 2).
   */
  public async queryState(): Promise<number> {
    const res = await this.sendRequest({
      cmd: CMD_QUERY,
      msg: { attr: [0] }
    });

    if (res.msg && res.msg.data && typeof res.msg.data === 'object') {
      const { bitmask, hasChange } = parseBitmaskFromData(res.msg.data, this.currentBitmask);
      this.currentBitmask = bitmask;
      if (hasChange || !this.hasReceivedInitialState) {
        this.hasReceivedInitialState = true;
        this.emit('state', bitmask);
      }
      return bitmask;
    }

    return this.currentBitmask;
  }

  /**
   * Set state of a single gang (0-indexed).
   */
  public async setGangState(gangIndex: number, turnOn: boolean): Promise<number> {
    const newBitmask = calcNewBitmask(this.currentBitmask, gangIndex, turnOn);

    // Optimistic local state update if changed
    if (this.currentBitmask !== newBitmask) {
      this.currentBitmask = newBitmask;
      this.emit('state', newBitmask);
    }

    try {
      await this.sendRequest({
        cmd: CMD_SET,
        msg: {
          attr: [1],
          data: { '1': newBitmask }
        }
      });
    } catch (err) {
      // Re-query on error to revert to actual state
      this.queryState().catch(() => {});
      throw err;
    }

    return newBitmask;
  }

  /**
   * Set all gangs on or off in a single command.
   */
  public async setAllGangs(gangCount: number, turnOn: boolean): Promise<number> {
    const newBitmask = turnOn ? (1 << gangCount) - 1 : 0;

    if (this.currentBitmask !== newBitmask) {
      this.currentBitmask = newBitmask;
      this.emit('state', newBitmask);
    }

    try {
      await this.sendRequest({
        cmd: CMD_SET,
        msg: {
          attr: [1],
          data: { '1': newBitmask }
        }
      });
    } catch (err) {
      this.queryState().catch(() => {});
      throw err;
    }

    return newBitmask;
  }

  /**
   * Send a specific bitmask to control relays (CMD 3).
   */
  public async setBitmask(newBitmask: number): Promise<number> {
    // Optimistic local state update
    if (this.currentBitmask !== newBitmask) {
      this.currentBitmask = newBitmask;
      this.emit('state', newBitmask);
    }

    try {
      await this.sendRequest({
        cmd: CMD_SET,
        msg: {
          attr: [1],
          data: { '1': newBitmask }
        }
      });
    } catch (err) {
      // Re-query on error to revert to actual state
      this.queryState().catch(() => {});
      throw err;
    }

    return newBitmask;
  }

  /**
   * Get whether a specific gang is currently considered ON.
   */
  public isGangOn(gangIndex: number): boolean {
    return isGangOn(this.currentBitmask, gangIndex);
  }

  private rejectAllPending(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  /**
   * Static probe helper to test if an IP address is a CozyLife device and retrieve its info.
   */
  public static async probe(ip: string, port = 5555, timeoutMs = 3000): Promise<CozyLifeDeviceInfo> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = '';
      const sn = String(Date.now());

      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection to ${ip}:${port} timed out`));
      }, timeoutMs);

      socket.connect(port, ip, () => {
        const req = { cmd: CMD_INFO, pv: 0, sn, msg: {} };
        socket.write(JSON.stringify(req) + '\r\n', 'utf8');
      });

      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const res: CozyLifeMessage = JSON.parse(trimmed);
            if (res.msg && res.msg.did) {
              clearTimeout(timer);
              socket.destroy();
              return resolve({
                did: res.msg.did,
                pid: res.msg.pid || '',
                dtp: res.msg.dtp,
                mac: res.msg.mac,
                ip: res.msg.ip || ip,
                sv: res.msg.sv,
                hv: res.msg.hv
              });
            }
          } catch {
            // Wait for more chunks
          }
        }
      });

      socket.on('error', (err: Error) => {
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      });
    });
  }
}
