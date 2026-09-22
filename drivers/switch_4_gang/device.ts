import { CozyLifeBaseSwitchDevice } from '../../lib/CozyLifeBaseDevice';

module.exports = class Switch4GangDevice extends CozyLifeBaseSwitchDevice {
  get gangCount(): number {
    return 4;
  }
};
