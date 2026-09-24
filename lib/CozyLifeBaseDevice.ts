import Homey from 'homey';
import net from 'net';
import { CozyLifeClient, isGangOn } from './CozyLifeClient';

export abstract class CozyLifeBaseSwitchDevice extends Homey.Device {
  public client: CozyLifeClient | null = null;
  protected pollIntervalTimer: NodeJS.Timeout | null = null;

  abstract get gangCount(): number;

  async onInit() {
    this.log(`CozyLife Switch (${this.gangCount}-gang) initialized:`, this.getName());

    const settings = this.getSettings();
    const ip = String(settings.ip ?? '').trim();
    const port = Number(settings.port ?? 5555);

    if (!net.isIPv4(ip) || !Number.isInteger(port) || port < 1 || port > 65535) {
      this.error('Invalid device connection settings');
      await this.setUnavailable(this.homey.__('errors.invalid_settings'));
      return;
    }

    this.client = this.createClient(ip, port);

    // Register capability listeners
    if (this.gangCount === 1) {
      this.registerCapabilityListener('onoff', async (value: boolean) => {
        this.log(`Setting switch onoff ->`, value);
        await this.client?.setGangState(0, value);
      });
    } else {
      for (let i = 1; i <= this.gangCount; i++) {
        const gangIndex = i - 1;
        const capabilityId = `onoff.${i}`;
        this.registerCapabilityListener(capabilityId, async (value: boolean) => {
          this.log(`Setting gang ${i} (${capabilityId}) ->`, value);
          await this.client?.setGangState(gangIndex, value);
        });
      }
    }

    // Connect to device
    try {
      await this.client.connect();
      await this.setAvailable();
    } catch (err: any) {
      this.error('Initial connection failed:', err.message);
      await this.setUnavailable(err.message || 'Offline');
    }

    // Set up fallback polling (in addition to TCP push)
    const pollInterval = typeof settings.poll_interval === 'number' ? settings.poll_interval : 30;
    this.setupPolling(pollInterval);
  }

  private createClient(ip: string, port: number): CozyLifeClient {
    const client = new CozyLifeClient(ip, port, (...args) => this.log(...args));

    client.on('state', (bitmask: number) => {
      this.updateCapabilities(bitmask).catch((err) => {
        this.error('Failed to update capabilities from bitmask:', err);
      });
    });
    client.on('connected', () => {
      this.log('CozyLife TCP client connected to', ip);
      this.setAvailable().catch(this.error);
    });
    client.on('disconnected', () => {
      this.log('CozyLife TCP client disconnected from', ip);
    });

    return client;
  }

  protected previousBitmask: number | null = null;

  async updateCapabilities(bitmask: number) {
    const prev = this.previousBitmask;
    this.previousBitmask = bitmask;

    if (this.gangCount === 1) {
      const isOn = isGangOn(bitmask, 0);
      await this.setCapabilityValue('onoff', isOn).catch((err) => this.error('Error setting onoff capability:', err));
    } else {
      const driverId = this.driver.id;
      const triggerTurnedOn = this.homey.flow.getDeviceTriggerCard(`${driverId}_turned_on`);
      const triggerTurnedOff = this.homey.flow.getDeviceTriggerCard(`${driverId}_turned_off`);

      for (let i = 1; i <= this.gangCount; i++) {
        const gangIndex = i - 1;
        const capabilityId = `onoff.${i}`;
        const isOn = isGangOn(bitmask, gangIndex);
        await this.setCapabilityValue(capabilityId, isOn).catch((err) => this.error(`Error setting ${capabilityId} capability:`, err));

        // Trigger Flow cards if state changed
        if (prev !== null) {
          const wasOn = isGangOn(prev, gangIndex);
          if (!wasOn && isOn) {
            this.log(`Triggering Flow: ${driverId}_turned_on for gang ${i}`);
            triggerTurnedOn?.trigger(this, {}, { gang: String(i) }).catch((err: any) => this.error('Trigger error:', err));
          } else if (wasOn && !isOn) {
            this.log(`Triggering Flow: ${driverId}_turned_off for gang ${i}`);
            triggerTurnedOff?.trigger(this, {}, { gang: String(i) }).catch((err: any) => this.error('Trigger error:', err));
          }
        }
      }
    }
  }

  setupPolling(intervalSeconds: number) {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }

    if (intervalSeconds > 0) {
      this.pollIntervalTimer = setInterval(async () => {
        if (this.client && this.client.isConnected) {
          try {
            await this.client.queryState();
            if (!this.getAvailable()) {
              await this.setAvailable();
            }
          } catch (err) {
            this.error('Polling queryState failed:', err);
          }
        }
      }, intervalSeconds * 1000);
    }
  }

  async onSettings({ newSettings, changedKeys }: { oldSettings: any; newSettings: any; changedKeys: string[] }) {
    this.log('Settings changed:', changedKeys);

    const ip = String(newSettings.ip ?? '').trim();
    const port = Number(newSettings.port ?? 5555);
    const pollInterval = Number(newSettings.poll_interval ?? 30);

    if (!net.isIPv4(ip)) {
      throw new Error(this.homey.__('errors.invalid_ip'));
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(this.homey.__('errors.invalid_port'));
    }
    if (!Number.isFinite(pollInterval) || pollInterval < 5) {
      throw new Error(this.homey.__('errors.invalid_poll_interval'));
    }

    if (changedKeys.includes('ip') || changedKeys.includes('port')) {
      this.client?.disconnect();
      this.client = this.createClient(ip, port);
      await this.client.connect();
    }

    if (changedKeys.includes('poll_interval')) {
      this.setupPolling(pollInterval);
    }
  }

  async onDeleted() {
    this.log('Device deleted, disconnecting client...');
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }
}
