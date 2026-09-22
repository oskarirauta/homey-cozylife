import { CozyLifeBaseDriver } from '../../lib/CozyLifeBaseDriver';

module.exports = class Switch3GangDriver extends CozyLifeBaseDriver {
  get gangCount(): number {
    return 3;
  }

  get defaultDeviceName(): string {
    return 'CozyLife Switch (3-Gang)';
  }
};
