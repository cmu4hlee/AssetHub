const { getContainer } = require('../core/ServiceContainer');
const { getDatabase } = require('../core/DatabaseInterface');
const { getEventBus } = require('../core/EventBus');

const DepartmentService = require('../services/department.service');
const ScrappingService = require('../services/scrapping.service');
const ProcurementService = require('../services/procurement.service');
const TransferService = require('../services/transfer.service');
const InventoryService = require('../services/inventory.service');
const IdleAssetService = require('../services/idle-asset.service');
const UserService = require('../services/user.service');
const AuditLogService = require('../services/audit-log.service');
const PermissionService = require('../services/permission.service');

function registerAllServices(cacheService = null) {
  const container = getContainer();
  const db = getDatabase();
  const eventBus = getEventBus();

  const serviceOptions = { db, eventBus, cacheService };

  container.registerInstance('database', db);
  container.registerInstance('eventBus', eventBus);

  container.register('departmentService', () => {
    return new DepartmentService(serviceOptions);
  });

  container.register('scrappingService', () => {
    return new ScrappingService(serviceOptions);
  });

  container.register('procurementService', () => {
    return new ProcurementService(serviceOptions);
  });

  container.register('transferService', () => {
    return new TransferService(serviceOptions);
  });

  container.register('inventoryService', () => {
    return new InventoryService(serviceOptions);
  });

  container.register('idleAssetService', () => {
    return new IdleAssetService(serviceOptions);
  });

  container.register('userService', () => {
    return new UserService(serviceOptions);
  });

  container.register('auditLogService', () => {
    return new AuditLogService(serviceOptions);
  });

  container.register('permissionService', () => {
    return new PermissionService(serviceOptions);
  });

  return container;
}

function getService(name) {
  const container = getContainer();
  if (container.has(name)) {
    return container.get(name);
  }
  return null;
}

module.exports = { registerAllServices, getService };
