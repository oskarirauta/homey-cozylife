import { CozyLifeBaseSwitchDevice } from '../../lib/CozyLifeBaseDevice';

module.exports = class Switch2GangDevice extends CozyLifeBaseSwitchDevice {
  get gangCount(): number {
    return 2;
  }
};
