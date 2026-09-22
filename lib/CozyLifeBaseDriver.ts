import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import net from 'net';
import { CozyLifeClient } from './CozyLifeClient';

export abstract class CozyLifeBaseDriver extends Homey.Driver {
  abstract get gangCount(): number;
  abstract get defaultDeviceName(): string;

  async onInit() {
    this.log(`CozyLife ${this.gangCount}-Gang Switch driver initialized`);

    if (this.gangCount > 1) {
      const driverId = this.id;

      const getGangArg = (arg: any): string => {
        if (!arg) return '1';
        if (typeof arg === 'object' && arg.id) return String(arg.id);
        return String(arg);
      };

      // 1. Triggers run listeners (match selected gang)
      const triggerTurnedOn = this.homey.flow.getDeviceTriggerCard(`${driverId}_turned_on`);
      if (triggerTurnedOn) {
        triggerTurnedOn.registerRunListener(async (args, state) => {
          return getGangArg(args.gang) === String(state.gang);
        });
      }

      const triggerTurnedOff = this.homey.flow.getDeviceTriggerCard(`${driverId}_turned_off`);
      if (triggerTurnedOff) {
        triggerTurnedOff.registerRunListener(async (args, state) => {
          return getGangArg(args.gang) === String(state.gang);
        });
      }

      // 2. Condition: Gang is on
      const conditionIsOn = this.homey.flow.getConditionCard(`${driverId}_is_on`);
      if (conditionIsOn) {
        conditionIsOn.registerRunListener(async (args: any) => {
          const gang = Number(getGangArg(args.gang));
          const gangIndex = gang - 1;
          const bitmask = args.device.client?.currentBitmask ?? 0;
          return (bitmask & (1 << gangIndex)) !== 0;
        });
      }

      // 3. Action: Turn gang on
      const actionTurnOn = this.homey.flow.getActionCard(`${driverId}_turn_on`);
      if (actionTurnOn) {
        actionTurnOn.registerRunListener(async (args: any) => {
          const gang = Number(getGangArg(args.gang));
          const gangIndex = gang - 1;
          await args.device.client?.setGangState(gangIndex, true);
        });
      }

      // 4. Action: Turn gang off
      const actionTurnOff = this.homey.flow.getActionCard(`${driverId}_turn_off`);
      if (actionTurnOff) {
        actionTurnOff.registerRunListener(async (args: any) => {
          const gang = Number(getGangArg(args.gang));
          const gangIndex = gang - 1;
          await args.device.client?.setGangState(gangIndex, false);
        });
      }

      // 5. Action: Toggle gang
      const actionToggle = this.homey.flow.getActionCard(`${driverId}_toggle`);
      if (actionToggle) {
        actionToggle.registerRunListener(async (args: any) => {
          const gang = Number(getGangArg(args.gang));
          const gangIndex = gang - 1;
          const bitmask = args.device.client?.currentBitmask ?? 0;
          const isCurrentOn = (bitmask & (1 << gangIndex)) !== 0;
          await args.device.client?.setGangState(gangIndex, !isCurrentOn);
        });
      }

      // 6. Action: All turn on
      const actionAllOn = this.homey.flow.getActionCard(`${driverId}_all_on`);
      if (actionAllOn) {
        actionAllOn.registerRunListener(async (args: any) => {
          if (args.device.client?.setAllGangs) {
            await args.device.client.setAllGangs(args.device.gangCount, true);
          } else {
            for (let i = 0; i < args.device.gangCount; i++) {
              await args.device.client?.setGangState(i, true);
            }
          }
        });
      }

      // 7. Action: All turn off
      const actionAllOff = this.homey.flow.getActionCard(`${driverId}_all_off`);
      if (actionAllOff) {
        actionAllOff.registerRunListener(async (args: any) => {
          if (args.device.client?.setAllGangs) {
            await args.device.client.setAllGangs(args.device.gangCount, false);
          } else {
            for (let i = 0; i < args.device.gangCount; i++) {
              await args.device.client?.setGangState(i, false);
            }
          }
        });
      }
    }
  }

  async onPair(session: PairSession): Promise<void> {
    let discoveredDevice: any = null;

    session.setHandler('connection_details_entered', async (data: { ipaddress: string }) => {
      this.log(`Pairing request received for IP:`, data.ipaddress);

      if (!data.ipaddress || !net.isIP(data.ipaddress.trim())) {
        throw new Error(this.homey.__('pair.invalid_ip'));
      }

      const ip = data.ipaddress.trim();

      try {
        const info = await CozyLifeClient.probe(ip, 5555, 4000);
        this.log(`Probe successful:`, info);

        discoveredDevice = {
          name: `${this.defaultDeviceName} (${ip})`,
          data: {
            id: info.did || `cozylife_${ip.replace(/\./g, '_')}`
          },
          settings: {
            ip,
            port: 5555,
            poll_interval: 30
          }
        };

        return true;
      } catch (err: any) {
        this.error(`Probe failed for ${ip}:`, err.message);
        throw new Error(this.homey.__('errors.connection_failed', { ip, port: '5555' }));
      }
    });

    session.setHandler('list_devices', async () => {
      if (discoveredDevice) {
        return [discoveredDevice];
      }
      return [];
    });
  }
}
