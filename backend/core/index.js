const { ServiceContainer, getInstance: getContainer, resetInstance: resetContainer } = require('./ServiceContainer');
const { DatabaseInterface, getInstance: getDatabase } = require('./DatabaseInterface');
const { EventBus, getInstance: getEventBus } = require('./EventBus');
const BaseService = require('./BaseService');
const ModuleInterface = require('./ModuleInterface');
const { ModuleLoader } = require('./module-loader');

module.exports = {
  ServiceContainer,
  getContainer,
  resetContainer,
  DatabaseInterface,
  getDatabase,
  EventBus,
  getEventBus,
  BaseService,
  ModuleInterface,
  ModuleLoader,
};
