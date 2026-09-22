import { CozyLifeBaseDriver } from '../../lib/CozyLifeBaseDriver';

module.exports = class Switch2GangDriver extends CozyLifeBaseDriver {
  get gangCount(): number {
    return 2;
  }

  get defaultDeviceName(): string {
    return 'CozyLife Switch (2-Gang)';
  }
};
