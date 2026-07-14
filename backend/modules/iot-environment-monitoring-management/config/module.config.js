module.exports = {
  id: 'iot-environment-monitoring-management',
  name: '环境监测模块',
  version: '1.0.0',
  description: '温湿度等环境参数采集模块（MQTT + Kafka + 时序）',
  category: '物联与定位',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2026-02-23T00:00:00Z',
  updated_at: '2026-02-23T00:00:00Z',

  dependencies: [
    {
      module_id: 'iot-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
  ],

  compatibility: [],

  frontend_config: {
    menu_keys: ['/environment-monitoring'],
    menu_prefixes: ['/environment-monitoring'],
    menu_routes: [
      {
        key: '/environment-monitoring',
        icon: 'DashboardOutlined',
        label: '环境监测',
        path: '/environment-monitoring',
        component: 'EnvironmentMonitoring',
        permissions: ['iot:data:read'],
      },
    ],
    components: [
      {
        name: 'EnvironmentMonitoring',
        path: 'pages/EnvironmentMonitoring',
        export: 'default',
      },
    ],
    permissions: ['iot:data:read', 'iot:integration:manage'],
  },

  backend_config: {
    auto_register: true,
    api_prefix: '/api/iot-environment-monitoring',
    api_endpoints: [
      { method: 'POST', path: '/api/iot-environment-monitoring/ingest', handler: 'ingest', permissions: [] },
      { method: 'POST', path: '/api/iot-environment-monitoring/ingest/batch', handler: 'ingestBatch', permissions: [] },
      { method: 'POST', path: '/api/iot-environment-monitoring/sample', handler: 'ingestSample', permissions: ['iot:monitoring:manage'] },
      { method: 'GET', path: '/api/iot-environment-monitoring/devices/:deviceId/latest', handler: 'getLatestByDevice', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-environment-monitoring/assets/:assetCode/latest', handler: 'getLatestByAsset', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-environment-monitoring/assets/:assetCode/series', handler: 'getAssetSeries', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-environment-monitoring/pipeline/health', handler: 'pipelineHealth', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-environment-monitoring/pipeline/docs', handler: 'pipelineDocs', permissions: ['iot:monitoring:view'] },
    ],
    database_tables: ['iot_environment_monitor_ts'],
    services: [{ name: 'EnvironmentMonitoringPipelineService', path: 'services/environment-monitoring-pipeline.service' }],
    permissions: ['iot:monitoring:view', 'iot:monitoring:manage', 'iot:alert:read', 'iot:alert:manage'],
    environment_variables: [
      'IOT_ENV_INGEST_TOKEN', 'IOT_ENV_KAFKA_ENABLED', 'IOT_ENV_KAFKA_BROKERS',
      'IOT_ENV_KAFKA_TOPIC', 'IOT_ENV_KAFKA_CLIENT_ID', 'IOT_ENV_MQTT_ENABLED',
      'IOT_ENV_MQTT_BROKER_URL', 'IOT_ENV_MQTT_TOPIC', 'IOT_ENV_MQTT_USERNAME',
      'IOT_ENV_MQTT_PASSWORD', 'IOT_ENV_TSDB',
    ],
  },

  config_schema: [],

  default_config: {
    mqtt_enabled: false,
    kafka_enabled: false,
    tsdb: 'mysql_ts_table',
  },

  interfaces: [
    {
      name: 'EnvironmentMonitoringIngest',
      type: 'REST/MQTT',
      description: '环境监测数据接收接口',
    },
  ],
};
