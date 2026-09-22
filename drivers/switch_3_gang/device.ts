import { CozyLifeBaseSwitchDevice } from '../../lib/CozyLifeBaseDevice';

module.exports = class Switch3GangDevice extends CozyLifeBaseSwitchDevice {
  get gangCount(): number {
    return 3;
  }
};
