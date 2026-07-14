import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Tree,
  Tag,
  Tabs,
  Collapse,
  Button,
  Empty,
  Spin,
  message,
  Badge,
  Divider,
  Modal,
  Form,
  Select,
  Switch,
  Space,
  Tooltip,
} from 'antd';
import {
  ApiOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  BookOutlined,
  LinkOutlined,
  CodeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';

const { Search } = Input;
const { Panel } = Collapse;
const { TabPane } = Tabs;
const { Option } = Select;

const APIDocumentation = () => {
  const [loading, setLoading] = useState(true);
  const [apiData, setApiData] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedModules, setExpandedModules] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [copySuccess, setCopySuccess] = useState('');
  const [responseFormat, setResponseFormat] = useState('json');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    fetchAPIDocumentation();
  }, []);

  const fetchAPIDocumentation = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api-documentation');
      if (response.data.success) {
        setApiData(response.data.data);
        setModules(response.data.data.modules || []);
        if (response.data.data.modules?.length > 0) {
          setSelectedModule(response.data.data.modules[0]);
        }
      } else {
        message.error('获取API文档失败');
      }
    } catch (error) {
      console.error('获取API文档失败:', error);
      message.error('获取API文档失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  const getMethodColor = method => {
    const colors = {
      GET: '#52c41a',
      POST: '#1890ff',
      PUT: '#faad14',
      DELETE: '#ff4d4f',
      PATCH: '#722ed1',
    };
    return colors[method] || '#999';
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      message.success(`已复制 ${label}`);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      message.error('复制失败');
    }
  };

  const generateCodeExample = (endpoint, format = 'json') => {
    const { method, path, requestBody, parameters } = endpoint;
    const baseUrl = 'http://103.40.14.91:17565/api';

    if (format === 'curl') {
      let curlCmd = `curl -X ${method} "${baseUrl}${path}" \\\n`;
      curlCmd += `  -H "Authorization: Bearer YOUR_TOKEN" \\\n`;
      curlCmd += `  -H "Content-Type: application/json"`;

      if (method === 'POST' || method === 'PUT') {
        curlCmd += ` \\\n  -d '{\n`;
        if (requestBody) {
          const sampleData = {};
          Object.entries(requestBody).forEach(([key, value], index, arr) => {
            const isLast = index === arr.length - 1;
            const sampleValue =
              value.type === 'string'
                ? `"sample_${key}"`
                : value.type === 'integer' || value.type === 'number'
                  ? 0
                  : value.type === 'boolean'
                    ? true
                    : value.type === 'file'
                      ? '@file.xlsx'
                      : 'null';
            sampleData[key] = sampleValue;
          });
          curlCmd += `    ${JSON.stringify(sampleData).slice(1, -1).replace(/"/g, '"').replace(/,/g, ',\n    ')}\n`;
        }
        curlCmd += `  }'`;
      }
      return curlCmd;
    }

    const sampleRequest = {
      method,
      url: `${baseUrl}${path}`,
      headers: {
        Authorization: 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
      },
    };

    if (requestBody) {
      sampleRequest.body = requestBody;
    }

    return JSON.stringify(sampleRequest, null, 2);
  };

  const filterModules = () => {
    if (!searchKeyword.trim()) return modules;
    const keyword = searchKeyword.toLowerCase();
    return modules.filter(
      module =>
        module.name.toLowerCase().includes(keyword) ||
        module.description.toLowerCase().includes(keyword) ||
        module.path.toLowerCase().includes(keyword)
    );
  };

  const renderParameters = parameters => {
    if (!parameters || parameters.length === 0) return null;
    return (
      <div className="parameters-section">
        <h4>
          <InfoCircleOutlined /> 请求参数
        </h4>
        <div className="parameters-table">
          <table>
            <thead>
              <tr>
                <th>参数名</th>
                <th>类型</th>
                <th>必填</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((param, index) => (
                <tr key={index}>
                  <td className="param-name">{param.name}</td>
                  <td>
                    <Tag>{param.type}</Tag>
                  </td>
                  <td>
                    {param.required ? (
                      <Badge status="error" text="是" />
                    ) : (
                      <Badge status="default" text="否" />
                    )}
                  </td>
                  <td>{param.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRequestBody = requestBody => {
    if (!requestBody) return null;
    return (
      <div className="request-body-section">
        <h4>
          <CodeOutlined /> 请求体
        </h4>
        <div className="code-block">
          <div className="code-header">
            <span>JSON</span>
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(JSON.stringify(requestBody, null, 2), '请求体示例')}
            >
              {copySuccess === '请求体示例' ? '已复制' : '复制'}
            </Button>
          </div>
          <pre>{JSON.stringify(requestBody, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const renderResponseExample = response => {
    if (!response) return null;
    return (
      <div className="response-section">
        <h4>
          <CheckCircleOutlined /> 响应示例
        </h4>
        <div className="code-block">
          <div className="code-header">
            <Tag color="success">200 OK</Tag>
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(JSON.stringify(response, null, 2), '响应示例')}
            >
              {copySuccess === '响应示例' ? '已复制' : '复制'}
            </Button>
          </div>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const renderEndpointDetail = endpoint => {
    return (
      <div className="endpoint-detail">
        <div className="endpoint-header">
          <div className="endpoint-title">
            <Tag color={getMethodColor(endpoint.method)} className="method-tag">
              {endpoint.method}
            </Tag>
            <span className="endpoint-path">{endpoint.path}</span>
          </div>
          <div className="endpoint-actions">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(endpoint.path, '接口路径')}
            />
          </div>
        </div>

        <p className="endpoint-description">{endpoint.description}</p>

        {renderParameters(endpoint.parameters)}
        {renderRequestBody(endpoint.requestBody)}
        {renderResponseExample(endpoint.response)}

        <div className="code-example-section">
          <h4>
            <CodeOutlined /> 请求示例
          </h4>
          <div className="code-block">
            <div className="code-header">
              <Select
                value={responseFormat}
                onChange={setResponseFormat}
                style={{ width: 120 }}
                size="small"
              >
                <Option value="json">JSON</Option>
                <Option value="curl">cURL</Option>
              </Select>
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyToClipboard(generateCodeExample(endpoint, responseFormat), '请求示例')
                }
              >
                {copySuccess === '请求示例' ? '已复制' : '复制'}
              </Button>
            </div>
            <pre>{generateCodeExample(endpoint, responseFormat)}</pre>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    if (!apiData) return null;
    return (
      <div className="api-overview">
        <Card className="info-card">
          <div className="api-title">
            <ApiOutlined />
            <h1>{apiData.info.title}</h1>
            <Tag color="blue">{apiData.info.version}</Tag>
          </div>
          <p className="api-description">{apiData.info.description}</p>

          <Divider />

          <div className="auth-section">
            <h3>
              <LinkOutlined /> 认证方式
            </h3>
            <div className="auth-info">
              <p>
                <strong>类型：</strong>
                {apiData.authentication.type}
              </p>
              <p>
                <strong>请求头：</strong>
                <code>{apiData.authentication.header}</code>
              </p>
              <p>
                <strong>示例：</strong>
                <code>{apiData.authentication.example}</code>
              </p>
              <p className="auth-tip">
                <WarningOutlined /> {apiData.authentication.description}
              </p>
            </div>
          </div>

          <Divider />

          <div className="modules-summary">
            <h3>
              <BookOutlined /> 模块概览
            </h3>
            <div className="modules-grid">
              {modules.map((module, index) => (
                <Card
                  key={index}
                  hoverable
                  size="small"
                  onClick={() => {
                    setSelectedModule(module);
                    setActiveTab('modules');
                  }}
                >
                  <Card.Meta
                    title={module.name}
                    description={
                      <span>
                        <code>{module.path}</code>
                        <br />
                        <Badge
                          count={module.endpointCount}
                          style={{ backgroundColor: '#52c41a' }}
                        />
                        <span> 个接口</span>
                      </span>
                    }
                  />
                </Card>
              ))}
            </div>
          </div>

          <Divider />

          <div className="error-codes">
            <h3>
              <CloseCircleOutlined /> 错误码说明
            </h3>
            <div className="error-table">
              <table>
                <thead>
                  <tr>
                    <th>错误码</th>
                    <th>消息</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(apiData.errorCodes).map(([code, info]) => (
                    <tr key={code}>
                      <td>
                        <Tag color="red">{code}</Tag>
                      </td>
                      <td>{info.message}</td>
                      <td>{info.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Divider />

          <div className="common-section">
            <h3>
              <InfoCircleOutlined /> 通用参数
            </h3>
            <div className="common-params">
              {Object.entries(apiData.commonParameters).map(([key, param]) => (
                <Card key={key} size="small">
                  <p>
                    <strong>参数名：</strong>
                    <code>{param.name}</code>
                  </p>
                  <p>
                    <strong>类型：</strong>
                    <Tag>{param.type}</Tag>
                  </p>
                  <p>
                    <strong>说明：</strong>
                    {param.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Divider />

          <div className="response-formats">
            <h3>
              <CodeOutlined /> 响应格式
            </h3>
            <Tabs type="card">
              <TabPane tab="成功响应" key="success">
                <div className="code-block">
                  <pre>{JSON.stringify(apiData.responseFormats.success, null, 2)}</pre>
                </div>
              </TabPane>
              <TabPane tab="错误响应" key="error">
                <div className="code-block">
                  <pre>{JSON.stringify(apiData.responseFormats.error, null, 2)}</pre>
                </div>
              </TabPane>
              <TabPane tab="分页响应" key="pagination">
                <div className="code-block">
                  <pre>{JSON.stringify(apiData.responseFormats.pagination, null, 2)}</pre>
                </div>
              </TabPane>
            </Tabs>
          </div>
        </Card>
      </div>
    );
  };

  const renderModules = () => {
    if (!selectedModule) {
      return <Empty description="请选择一个模块" />;
    }

    return (
      <div className="module-detail">
        <Card className="module-header">
          <div className="module-title">
            <h2>{selectedModule.name}</h2>
            <Tag>{selectedModule.path}</Tag>
          </div>
          <p>{selectedModule.description}</p>
        </Card>

        <div className="endpoints-list">
          {selectedModule.endpoints.map((endpoint, index) => (
            <Card key={index} className="endpoint-card">
              <Collapse defaultActiveKey={[`endpoint-${index}`]} expandIconPosition="end">
                <Panel
                  key={`endpoint-${index}`}
                  header={
                    <div className="endpoint-panel-header">
                      <Tag color={getMethodColor(endpoint.method)}>{endpoint.method}</Tag>
                      <span className="endpoint-path">{endpoint.path}</span>
                      <span className="endpoint-summary">{endpoint.summary}</span>
                    </div>
                  }
                >
                  {renderEndpointDetail(endpoint)}
                </Panel>
              </Collapse>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="api-doc-loading">
        <Spin size="large" description="加载API文档中..." />
      </div>
    );
  }

  return (
    <div className="api-documentation-page">
      <div className="api-doc-sidebar" style={{ width: sidebarCollapsed ? 0 : 280 }}>
        <div className="sidebar-header">
          <h3>
            <ApiOutlined /> API文档
          </h3>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        <Search
          placeholder="搜索模块..."
          allowClear
          onChange={e => setSearchKeyword(e.target.value)}
          style={{ margin: '16px', width: 'calc(100% - 32px)' }}
        />

        <div className="modules-tree">
          <Tree
            treeData={filterModules().map((module, index) => ({
              title: (
                <span>
                  <Badge count={module.endpointCount} size="small" />
                  <span style={{ marginLeft: 8 }}>{module.name}</span>
                </span>
              ),
              key: index,
              icon: <BookOutlined />,
            }))}
            selectedKeys={selectedModule ? [modules.indexOf(selectedModule).toString()] : []}
            onSelect={selectedKeys => {
              if (selectedKeys.length > 0) {
                setSelectedModule(modules[parseInt(selectedKeys[0])]);
              }
            }}
          />
        </div>
      </div>

      <div className="api-doc-content" style={{ marginLeft: sidebarCollapsed ? 0 : 280 }}>
        <div className="content-header">
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="概述" key="overview" />
            <TabPane
              tab={
                <span>
                  模块详情
                  {selectedModule && ` - ${selectedModule.name}`}
                </span>
              }
              key="modules"
            />
          </Tabs>
        </div>

        <div className="content-body" ref={contentRef}>
          {activeTab === 'overview' ? renderOverview() : renderModules()}
        </div>
      </div>

      <style>{`
        .api-documentation-page {
          display: flex;
          min-height: calc(100vh - 120px);
          background: #f5f5f5;
        }

        .api-doc-sidebar {
          width: 280px;
          background: #fff;
          border-right: 1px solid #e8e8e8;
          transition: width 0.3s;
          overflow: hidden;
          flex-shrink: 0;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #e8e8e8;
        }

        .sidebar-header h3 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modules-tree {
          padding: 16px 0;
        }

        .api-doc-content {
          flex: 1;
          padding: 24px;
          overflow: auto;
        }

        .content-header {
          margin-bottom: 24px;
        }

        .api-doc-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 400px;
        }

        .api-overview .info-card {
          max-width: 1000px;
        }

        .api-title {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .api-title h1 {
          margin: 0;
          flex: 1;
        }

        .api-description {
          font-size: 16px;
          color: #666;
          line-height: 1.6;
        }

        .auth-section, .modules-summary, .error-codes, .common-section, .response-formats {
          margin: 24px 0;
        }

        .auth-section h3, .modules-summary h3, .error-codes h3, .common-section h3, .response-formats h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .auth-info {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
        }

        .auth-info code {
          background: #e6f7ff;
          padding: 2px 6px;
          border-radius: 4px;
          color: #1890ff;
        }

        .auth-tip {
          color: #faad14;
          margin-top: 8px;
        }

        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .modules-grid .ant-card {
          cursor: pointer;
          transition: all 0.3s;
        }

        .modules-grid .ant-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .modules-grid code {
          background: #f5f5f5;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 12px;
        }

        .error-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .error-table th, .error-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e8e8e8;
        }

        .error-table th {
          background: #fafafa;
          font-weight: 600;
        }

        .common-params {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }

        .common-params code {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .code-block {
          background: #282c34;
          border-radius: 8px;
          overflow: hidden;
          margin: 16px 0;
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #21252b;
          border-bottom: 1px solid #3e4451;
        }

        .code-header span {
          color: #abb2bf;
        }

        .code-header button {
          color: #abb2bf;
        }

        .code-header button:hover {
          color: #fff;
        }

        .code-block pre {
          margin: 0;
          padding: 16px;
          color: #abb2bf;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .parameters-section, .request-body-section, .response-section, .code-example-section {
          margin: 24px 0;
        }

        .parameters-section h4, .request-body-section h4, .response-section h4, .code-example-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .parameters-table table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
        }

        .parameters-table th, .parameters-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e8e8e8;
        }

        .parameters-table th {
          background: #fafafa;
          font-weight: 600;
        }

        .param-name {
          font-family: monospace;
          font-weight: 600;
          color: #1890ff;
        }

        .module-detail .module-header {
          margin-bottom: 24px;
        }

        .module-title {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .module-title h2 {
          margin: 0;
        }

        .endpoints-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .endpoint-card {
          border-radius: 8px;
          overflow: hidden;
        }

        .endpoint-panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .method-tag {
          font-weight: 600;
          min-width: 60px;
          text-align: center;
        }

        .endpoint-path {
          font-family: monospace;
          color: #333;
        }

        .endpoint-summary {
          color: #666;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .endpoint-detail {
          padding: 16px 0;
        }

        .endpoint-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .endpoint-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .endpoint-description {
          color: #666;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .endpoint-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};

export default APIDocumentation;
