module.exports = {
  id: 'iot-asset-monitoring-management',
  name: '资产监测模块',
  version: '1.0.0',
  description: '资产运行状态与遥测监测接入模块（MQTT + Kafka + 时序）',
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
    {
      module_id: 'asset-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: null,
    },
  ],

  compatibility: [],

  frontend_config: {
    menu_keys: ['/asset-monitoring'],
    menu_prefixes: ['/asset-monitoring'],
    menu_routes: [
      {
        key: '/asset-monitoring',
        icon: 'AreaChartOutlined',
        label: '资产监测',
        path: '/asset-monitoring',
        component: 'AssetMonitoring',
        permissions: ['iot:data:read'],
      },
    ],
    components: [
      {
        name: 'AssetMonitoring',
        path: 'pages/AssetMonitoring',
        export: 'default',
      },
    ],
    permissions: ['iot:data:read', 'iot:data:manage'],
  },

  backend_config: {
    auto_register: true,
    api_prefix: '/api/iot-asset-monitoring',
    api_endpoints: [
      { method: 'POST', path: '/api/iot-asset-monitoring/ingest', handler: 'ingest', permissions: [] },
      { method: 'POST', path: '/api/iot-asset-monitoring/ingest/batch', handler: 'ingestBatch', permissions: [] },
      { method: 'POST', path: '/api/iot-asset-monitoring/sample', handler: 'ingestSample', permissions: ['iot:monitoring:manage'] },
      { method: 'GET', path: '/api/iot-asset-monitoring/devices/:deviceId/latest', handler: 'getLatestByDevice', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-asset-monitoring/assets/:assetCode/latest', handler: 'getLatestByAsset', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-asset-monitoring/assets/:assetCode/series', handler: 'getAssetSeries', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-asset-monitoring/pipeline/health', handler: 'pipelineHealth', permissions: ['iot:monitoring:view'] },
      { method: 'GET', path: '/api/iot-asset-monitoring/pipeline/docs', handler: 'pipelineDocs', permissions: ['iot:monitoring:view'] },
    ],
    database_tables: ['iot_asset_monitor_ts'],
    services: [{ name: 'AssetMonitoringPipelineService', path: 'services/asset-monitoring-pipeline.service' }],
    permissions: ['iot:monitoring:view', 'iot:monitoring:manage', 'iot:alert:read', 'iot:alert:manage'],
    environment_variables: [
      'IOT_ASSET_MON_INGEST_TOKEN', 'IOT_ASSET_MON_KAFKA_ENABLED', 'IOT_ASSET_MON_KAFKA_BROKERS',
      'IOT_ASSET_MON_KAFKA_TOPIC', 'IOT_ASSET_MON_KAFKA_CLIENT_ID', 'IOT_ASSET_MON_MQTT_ENABLED',
      'IOT_ASSET_MON_MQTT_BROKER_URL', 'IOT_ASSET_MON_MQTT_TOPIC', 'IOT_ASSET_MON_MQTT_USERNAME',
      'IOT_ASSET_MON_MQTT_PASSWORD', 'IOT_ASSET_MON_TSDB',
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
      name: 'AssetMonitoringIngest',
      type: 'REST/MQTT',
      description: '资产实时监测数据接收接口',
    },
  ],
};
