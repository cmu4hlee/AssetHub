module.exports = {
  id: 'iot-zone-location-management',
  name: '区域定位模块',
  version: '1.0.0',
  description: '面向信标与定位网关的区域定位接入模块（MQTT + Kafka + 时序）',
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
    menu_keys: ['/beacon-location'],
    menu_prefixes: ['/beacon-location'],
    menu_routes: [
      {
        key: '/beacon-location',
        icon: 'RadarChartOutlined',
        label: '区域定位',
        path: '/beacon-location',
        component: 'BeaconLocation',
        permissions: ['iot:data:read'],
      },
    ],
    components: [
      {
        name: 'BeaconLocation',
        path: 'pages/BeaconLocation',
        export: 'default',
      },
    ],
    permissions: ['iot:data:read', 'iot:integration:manage'],
  },

  backend_config: {
    auto_register: true,
    api_prefix: '/api/iot-zone-location',
    api_endpoints: [
      { method: 'POST', path: '/api/iot-zone-location/ingest', handler: 'ingest', permissions: [] },
      { method: 'POST', path: '/api/iot-zone-location/ingest/batch', handler: 'ingestBatch', permissions: [] },
      { method: 'POST', path: '/api/iot-zone-location/sample', handler: 'ingestSample', permissions: ['iot:location:manage'] },
      { method: 'GET', path: '/api/iot-zone-location/devices/:deviceId/latest', handler: 'getLatestByDevice', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-zone-location/assets/:assetCode/latest', handler: 'getLatestByAsset', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-zone-location/assets/:assetCode/series', handler: 'getAssetSeries', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-zone-location/pipeline/health', handler: 'pipelineHealth', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-zone-location/pipeline/docs', handler: 'pipelineDocs', permissions: ['iot:data:read'] },
    ],
    database_tables: ['iot_zone_location_ts', 'asset_locations'],
    services: [{ name: 'ZoneLocationPipelineService', path: 'services/zone-location-pipeline.service' }],
    permissions: ['iot:data:read', 'iot:data:manage', 'iot:location:view', 'iot:location:manage'],
    environment_variables: [
      'IOT_ZONE_INGEST_TOKEN', 'IOT_ZONE_KAFKA_ENABLED', 'IOT_ZONE_KAFKA_BROKERS',
      'IOT_ZONE_KAFKA_TOPIC', 'IOT_ZONE_KAFKA_CLIENT_ID', 'IOT_ZONE_MQTT_ENABLED',
      'IOT_ZONE_MQTT_BROKER_URL', 'IOT_ZONE_MQTT_TOPIC', 'IOT_ZONE_MQTT_USERNAME',
      'IOT_ZONE_MQTT_PASSWORD', 'IOT_ZONE_TSDB',
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
      name: 'ZoneLocationIngest',
      type: 'REST/MQTT',
      description: '区域定位数据接收接口',
    },
  ],
};
