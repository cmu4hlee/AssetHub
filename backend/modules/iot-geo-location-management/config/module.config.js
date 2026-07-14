module.exports = {
  id: 'iot-geo-location-management',
  name: '地理定位模块',
  version: '1.0.0',
  description: '基于地图的资产地理定位与轨迹管理模块',
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
    menu_keys: ['/asset-location'],
    menu_prefixes: ['/asset-location'],
    menu_routes: [
      {
        key: '/asset-location',
        icon: 'EnvironmentOutlined',
        label: '地理定位',
        path: '/asset-location',
        component: 'AssetLocationMap',
        permissions: ['iot:data:read'],
      },
    ],
    components: [
      {
        name: 'AssetLocationMap',
        path: 'pages/AssetLocationMap',
        export: 'default',
      },
    ],
    permissions: ['iot:data:read', 'iot:data:manage'],
  },

  backend_config: {
    auto_register: true,
    api_prefix: '/api/iot-geo-location',
    api_endpoints: [
      { method: 'POST', path: '/api/iot-geo-location/ingest', handler: 'ingest', permissions: [] },
      { method: 'POST', path: '/api/iot-geo-location/ingest/batch', handler: 'ingestBatch', permissions: [] },
      { method: 'POST', path: '/api/iot-geo-location/sample', handler: 'ingestSample', permissions: ['iot:location:manage'] },
      { method: 'GET', path: '/api/iot-geo-location/devices/:deviceId/latest', handler: 'getLatestByDevice', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-geo-location/assets/:assetCode/latest', handler: 'getLatestByAsset', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-geo-location/assets/:assetCode/series', handler: 'getAssetSeries', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-geo-location/pipeline/health', handler: 'pipelineHealth', permissions: ['iot:data:read'] },
      { method: 'GET', path: '/api/iot-geo-location/pipeline/docs', handler: 'pipelineDocs', permissions: ['iot:data:read'] },
    ],
    database_tables: ['iot_geo_location_ts'],
    services: [{ name: 'GeoLocationService', path: 'services/location.service' }],
    permissions: ['iot:data:read', 'iot:data:manage', 'iot:location:view', 'iot:location:manage'],
    environment_variables: [
      'IOT_GEO_INGEST_TOKEN', 'IOT_GEO_KAFKA_ENABLED', 'IOT_GEO_KAFKA_BROKERS',
      'IOT_GEO_KAFKA_TOPIC', 'IOT_GEO_KAFKA_CLIENT_ID', 'IOT_GEO_MQTT_ENABLED',
      'IOT_GEO_MQTT_BROKER_URL', 'IOT_GEO_MQTT_TOPIC', 'IOT_GEO_MQTT_USERNAME',
      'IOT_GEO_MQTT_PASSWORD', 'IOT_GEO_TSDB',
    ],
  },

  config_schema: [],

  default_config: {
    map_provider: 'amap',
    max_history_days: 30,
  },

  interfaces: [
    {
      name: 'GeoLocationRead',
      type: 'REST',
      description: '资产地理定位查询接口',
    },
  ],
};
