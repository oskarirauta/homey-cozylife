import { CozyLifeBaseDriver } from '../../lib/CozyLifeBaseDriver';

module.exports = class Switch4GangDriver extends CozyLifeBaseDriver {
  get gangCount(): number {
    return 4;
  }

  get defaultDeviceName(): string {
    return 'CozyLife Switch (4-Gang)';
  }
};
