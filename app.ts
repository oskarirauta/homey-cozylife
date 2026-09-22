import Homey from 'homey';

module.exports = class CozyLifeApp extends Homey.App {
  async onInit() {
    this.log('CozyLife App has been initialized');
  }
};
