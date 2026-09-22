import { CozyLifeBaseSwitchDevice } from '../../lib/CozyLifeBaseDevice';

module.exports = class Switch1GangDevice extends CozyLifeBaseSwitchDevice {
  get gangCount(): number {
    return 1;
  }
};
