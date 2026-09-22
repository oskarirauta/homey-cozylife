import { CozyLifeBaseDriver } from '../../lib/CozyLifeBaseDriver';

module.exports = class Switch1GangDriver extends CozyLifeBaseDriver {
  get gangCount(): number {
    return 1;
  }

  get defaultDeviceName(): string {
    return 'CozyLife Switch (1-Gang)';
  }
};
