const BaseService = require('./BaseService');

class ModuleInterface {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.version = config.version;
    this.description = config.description || '';
    this.dependencies = config.dependencies || [];
    this.exports = config.exports || {};
    this._service = config.service || null;
    this._routes = config.routes || null;
    this._apiPrefix = config.apiPrefix || `/api/${this.id}`;
    this._enabled = config.enabled !== false;
    this._initialized = false;
  }

  get isEnabled() {
    return this._enabled;
  }

  get isInitialized() {
    return this._initialized;
  }

  get service() {
    return this._service;
  }

  get routes() {
    return this._routes;
  }

  get apiPrefix() {
    return this._apiPrefix;
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
  }

  async initialize(container) {
    if (this._initialized) return;
    if (this._service && this._service instanceof BaseService) {
      if (!this._service.isInitialized) {
        await this._service.initialize();
      }
    }
    this._initialized = true;
  }

  async dispose() {
    if (this._service && typeof this._service.dispose === 'function') {
      await this._service.dispose();
    }
    this._initialized = false;
  }

  getPublicAPI() {
    if (!this.exports || typeof this.exports !== 'object') return {};
    const publicAPI = {};
    for (const [key, value] of Object.entries(this.exports)) {
      if (typeof value === 'function') {
        publicAPI[key] = value;
      }
    }
    return publicAPI;
  }

  getManifest() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      dependencies: this.dependencies,
      apiPrefix: this._apiPrefix,
      enabled: this._enabled,
      initialized: this._initialized,
      exports: Object.keys(this.exports),
    };
  }
}

module.exports = ModuleInterface;
