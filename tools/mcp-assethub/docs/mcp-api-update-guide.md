# AssetHub MCP API Update Guide
> Generated at: 2026-05-01T07:01:55.908Z
> Backend OpenAPI: 3.0.0
> MCP tools: 224
> MCP backend requests: 90
> Exact matches: 13
> Fuzzy matches: 77
> Unmatched requests: 0

## Summary
| 指标 | 数值 |
| --- | --- |
| MCP 工具数 | 224 |
| MCP 后端调用数 | 90 |
| 精确匹配 | 13 |
| 模糊匹配 | 77 |
| 未匹配 | 0 |

## Requests Requiring MCP Update
当前未发现未匹配的 MCP 请求。
## list_assets
- Handler: listAssets
- Description: 获取资产列表，支持分页、搜索和多种筛选条件，支持科室关键字模糊搜索

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码，默认1 |
| limit | integer | no | 每页数量，默认20 |
| keyword | string | no | 搜索关键词 |
| asset_code | string | no | 资产编号 |
| status | string | no | 资产状态：在用/维修/闲置/报废 |
| department | string | no | 科室关键字，支持模糊搜索 |
| department_code | string | no | 部门代码 |
| category_id | integer | no | 资产类别ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets | exact | GET /assets | 获取资产列表 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: GET /assets
- Summary: 获取资产列表
- Tags: 库存管理

### Authentication
无
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no |  |
| pageSize | integer | no |  |
| status | string | no |  |
| keyword | string | no |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
#### 403
缺少租户信息
##### application/json
### Response Schema (403 application/json)
无
## list_all_assets
- Handler: listAllAssets
- Description: 获取所有资产（全量查询，不分页），支持科室关键字模糊搜索

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| search | string | no | 搜索关键词 |
| status | string | no | 资产状态 |
| department | string | no | 科室关键字，支持模糊搜索 |
| department_id | integer | no | 部门ID |
| category_id | integer | no | 资产类别ID |
| location | string | no | 存放位置 |
| sortField | string | no | 排序字段 |
| sortOrder | string | no | 排序方向：asc/desc |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/all | fuzzy | GET /api/assets/all | 全量查询资产列表（不分页） |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/all
- Summary: 全量查询资产列表（不分页）
- Description: 返回所有符合条件的资产数据，用于数据导出等场景
- Tags: Assets

### Authentication
无
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| search | string | no | 搜索关键词（资产编码、名称、品牌） |
| status | string | no | 资产状态 |
| department_id | integer | no | 部门ID |
| category_id | integer | no | 资产类别ID |
| location | string | no | 存放位置 |
| sortField | string | no | 排序字段 |
| sortOrder | string | no | 排序方向（asc/desc） |
| batchSize | integer | no | 每批次查询数量 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功获取全量资产列表
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | array&lt;object&gt; | no |  |
| data[] | object | no |  |
| total | integer | no |  |
| meta | object | no |  |

## get_asset
- Handler: getAsset
- Description: 获取单个资产的详细信息

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 资产ID |
| asset_code | string | no | 资产编号（与id二选一） |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/{idOrCode} | exact | GET /assets/{id} | 获取资产详情 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: GET /assets/{id}
- Summary: 获取资产详情
- Tags: 库存管理

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes | 资产主键ID或资产编码 |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
#### 404
资产不存在
##### application/json
### Response Schema (404 application/json)
无
## create_asset
- Handler: createAsset
- Description: 创建新资产

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号（可自动生成） |
| asset_name | string | yes | 资产名称 |
| category_id | integer | yes | 资产类别ID |
| brand | string | no | 品牌 |
| model | string | no | 型号 |
| specification | string | no | 规格 |
| purchase_date | string | no | 购买日期 (YYYY-MM-DD) |
| purchase_price | number | no | 购买价格 |
| department_new | string | no | 部门代码 |
| location | string | no | 存放位置 |
| responsible_person | string | no | 责任人 |
| status | string | no | 状态 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /assets | exact | POST /assets | 新增资产 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: POST /assets
- Summary: 新增资产
- Tags: 库存管理

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes |  |
| asset_name | string | yes |  |
| category_id | integer | yes |  |
| purchase_date | string | no |  |
| purchase_price | number | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
#### 400
参数错误
##### application/json
### Response Schema (400 application/json)
无
## update_asset
- Handler: updateAsset
- Description: 更新资产信息

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 资产ID |
| asset_name | string | no | 资产名称 |
| specification | string | no | 规格 |
| purchase_price | number | no | 购买价格 |
| status | string | no | 状态 |
| department_new | string | no | 部门代码 |
| location | string | no | 存放位置 |
| responsible_person | string | no | 责任人 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /assets/{id} | exact | PUT /assets/{id} | 更新资产 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: PUT /assets/{id}
- Summary: 更新资产
- Tags: 库存管理

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_name | string | no |  |
| category_id | integer | no |  |
| status | string | no |  |
| department_new | string | no |  |

### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## delete_asset
- Handler: deleteAsset
- Description: 删除资产

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 资产ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| DELETE /assets/{id} | exact | DELETE /assets/{id} | 删除资产 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: DELETE /assets/{id}
- Summary: 删除资产
- Tags: 库存管理

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
删除成功
##### application/json
### Response Schema (200 application/json)
无
## get_asset_categories
- Handler: getAssetCategories
- Description: 获取资产类别列表，支持树形结构

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tree | boolean | no | 是否返回树形结构 |
| parent_id | integer | no | 父类别ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/categories | fuzzy | GET /api/assets/categories | 查询 /api/assets/categories |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/categories
- Summary: 查询 /api/assets/categories
- Description: 自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_asset_statistics
- Handler: getAssetStatistics
- Description: 获取资产总览统计信息，包括总数、总价值、按状态/类别分布

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/statistics/overview | fuzzy | GET /api/assets/statistics/overview | 查询 /api/assets/statistics/overview |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/statistics/overview
- Summary: 查询 /api/assets/statistics/overview
- Description: 自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_department_statistics
- Handler: getDepartmentStatistics
- Description: 获取部门资产统计信息

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/statistics/by-department | fuzzy | GET /api/assets/statistics/by-department | 查询 /api/assets/statistics/by-department |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/statistics/by-department
- Summary: 查询 /api/assets/statistics/by-department
- Description: 自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_value_statistics
- Handler: getValueStatistics
- Description: 获取资产价值统计信息，包括原值、现值、均值等；不等于折旧统计

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/statistics/overview | fuzzy | GET /api/assets/statistics/overview | 查询 /api/assets/statistics/overview |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/statistics/overview
- Summary: 查询 /api/assets/statistics/overview
- Description: 自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_depreciation
- Handler: listDepreciation

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_depreciation_detail
- Handler: getDepreciationDetail
- Description: 获取单个资产的折旧详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 资产ID |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 (YYYY-MM-DD) |
| residual_rate | number | no | 残值率 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /depreciation/{id} | fuzzy | GET /api/depreciation | 获取折旧列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/depreciation
- Summary: 获取折旧列表
- Description: 分页获取资产折旧数据
- Tags: 折旧管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| method | enum(straight_line, declining_balance, units_of_production) | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |
| residual_rate | number | no | 残值率 |
| status | string | no | 资产状态 |
| exclude_statuses | string | no | 排除的状态（逗号分隔） |
| include_disposed | boolean | no | 包含已处置资产 |
| asset_type | string | no | 资产类型 |
| category_id | integer | no | 资产类别ID |
| department | string | no | 部门 |
| department_id | integer | no | 部门ID |
| purchase_date_start | string | no | 购置日期开始 |
| purchase_date_end | string | no | 购置日期结束 |
| keyword | string | no | 搜索关键词 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
#### 500
服务器错误
## get_depreciation_summary_by_department
- Handler: getDepreciationSummaryByDepartment
- Description: 按部门汇总折旧数据

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_depreciation_summary_by_type
- Handler: getDepreciationSummaryByType
- Description: 按类型汇总折旧数据

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_depreciation_summary_by_month
- Handler: getDepreciationSummaryByMonth
- Description: 按月份查看折旧趋势

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| months | integer | no | 最近月份数，默认12 |
| keyword | string | no | 搜索关键词 |
| status | string | no | 资产状态 |
| department | string | no | 科室关键字 |
| department_id | integer | no | 部门ID |
| category_id | integer | no | 资产类别ID |
| asset_type | string | no | 资产类型 |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 (YYYY-MM-DD) |
| residual_rate | number | no | 残值率 |
| include_disposed | boolean | no | 是否包含报废/删除资产 |
| exclude_statuses | string | no | 排除状态，逗号分隔 |
| id | integer | yes | 资产ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_asset_change_logs
- Handler: getAssetChangeLogs

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/{id}/change-logs | fuzzy | GET /api/assets/{id}/change-logs | 获取资产变更日志 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/{id}/change-logs
- Summary: 获取资产变更日志
- Tags: Assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
无
## list_idle_assets
- Handler: listIdleAssets
- Description: 获取闲置资产列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| category_id | integer | no | 资产类别ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /idle | fuzzy | GET /api/idle | 查询 /api/idle |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/idle
- Summary: 查询 /api/idle
- Description: 自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: idle

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## publish_idle_asset
- Handler: publishIdleAsset
- Description: 发布闲置资产

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| publish_person | string | no | 发布人 |
| publish_date | string | no | 发布日期 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /idle | fuzzy | POST /api/idle | 创建/提交 /api/idle |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/idle
- Summary: 创建/提交 /api/idle
- Description: 自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: idle

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## allocate_idle_asset
- Handler: allocateIdleAsset
- Description: 调配闲置资产

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 闲置资产ID |
| target_department | string | no | 目标部门 |
| allocate_date | string | no | 调配日期 |
| comment | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /idle/{id}/allocate | fuzzy | PUT /api/idle/{id}/allocate | 更新 /api/idle/{id}/allocate |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/idle/{id}/allocate
- Summary: 更新 /api/idle/{id}/allocate
- Description: 自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: idle

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## cancel_idle_asset
- Handler: cancelIdleAsset

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /idle/{id}/cancel | fuzzy | PUT /api/idle/{id}/cancel | 更新 /api/idle/{id}/cancel |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/idle/{id}/cancel
- Summary: 更新 /api/idle/{id}/cancel
- Description: 自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: idle

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## transfer_asset
- Handler: transferAsset
- Description: 申请资产调配

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| target_department | string | yes | 调入部门 |
| reason | string | yes | 调配原因 |
| transfer_date | string | no | 调配日期 (YYYY-MM-DD，可选兼容字段) |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /assets/{assetCode}/transfer-apply | fuzzy | POST /api/assets/{id}/transfer-apply | 创建/提交 /api/assets/{id}/transfer-apply |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/assets/{id}/transfer-apply
- Summary: 创建/提交 /api/assets/{id}/transfer-apply
- Description: 自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_transfers
- Handler: listTransfers
- Description: 获取资产调配记录列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| status | string | no | 状态：pending/approved/rejected |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/transfer-requests | fuzzy | GET /api/assets/transfer-requests | 查询 /api/assets/transfer-requests |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/transfer-requests
- Summary: 查询 /api/assets/transfer-requests
- Description: 自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## approve_transfer
- Handler: approveTransfer
- Description: 审批资产调配申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 调配ID |
| action | string | yes | 操作：approve/reject |
| comment | string | no | 审批意见 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /assets/transfer-requests/{id}/approve | fuzzy | POST /api/assets/transfer-requests/{request_id}/approve | 创建/提交 /api/assets/transfer-requests/{request_id}/approve |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/assets/transfer-requests/{request_id}/approve
- Summary: 创建/提交 /api/assets/transfer-requests/{request_id}/approve
- Description: 自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| request_id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## execute_transfer
- Handler: executeTransfer
- Description: 完成资产调配

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 调配ID |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| status | string | no | 状态 |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /transfer/{id}/complete | fuzzy | PUT /api/transfer/{id}/complete | 更新 /api/transfer/{id}/complete |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/transfer/{id}/complete
- Summary: 更新 /api/transfer/{id}/complete
- Description: 自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: transfer

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_maintenance_logs
- Handler: listMaintenanceLogs
- Description: 获取维修日志列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| status | string | no | 状态 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/logs | exact | GET /maintenance/logs | 获取维护日志列表 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: GET /maintenance/logs
- Summary: 获取维护日志列表
- Tags: 维修维护

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
## create_maintenance_log
- Handler: createMaintenanceLog
- Description: 创建维修日志

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| maintenance_type | string | yes | 维修类型 |
| maintenance_date | string | yes | 维修日期 (YYYY-MM-DD) |
| maintenance_person | string | yes | 维修人员 |
| maintenance_content | string | yes | 维修内容 |
| maintenance_cost | number | no | 维修成本 |
| maintenance_duration | number | no | 维修时长(小时) |
| parts_replaced | string | no | 更换部件 |
| status | string | no | 状态 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/logs | exact | POST /maintenance/logs | 创建维护日志 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: POST /maintenance/logs
- Summary: 创建维护日志
- Tags: 维修维护

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes |  |
| maintenance_type | string | yes |  |
| maintenance_date | string | yes |  |
| cost | number | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
## get_maintenance_templates
- Handler: getMaintenanceTemplates
- Description: 获取维修模板列表

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/templates | fuzzy | GET /api/maintenance/templates | 查询 /api/maintenance/templates |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/maintenance/templates
- Summary: 查询 /api/maintenance/templates
- Description: 自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: maintenance

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_maintenance_efficiency
- Handler: getMaintenanceEfficiency
- Description: 获取维修效率统计

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/efficiency/overview | fuzzy | GET /api/maintenance/efficiency/overview | 查询 /api/maintenance/efficiency/overview |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/maintenance/efficiency/overview
- Summary: 查询 /api/maintenance/efficiency/overview
- Description: 自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: maintenance

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_maintenance_plans
- Handler: listMaintenancePlans
- Description: 获取预防性维护计划列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| status | string | no | 计划状态 |
| keyword | string | no | 关键词，匹配资产编号/资产名称/计划名称 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_maintenance_plan
- Handler: getMaintenancePlan
- Description: 获取单个预防性维护计划详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维护计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_maintenance_plan
- Handler: createMaintenancePlan
- Description: 创建预防性维护计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| plan_name | string | yes | 计划名称 |
| maintenance_type | string | yes | 维护类型 |
| cycle_type | string | yes | 周期类型，如按天/按周/按月/按季度/按年 |
| cycle_value | integer | yes | 周期值 |
| next_maintenance_date | string | no | 下次维护日期 (YYYY-MM-DD) |
| maintenance_content | string | no | 维护内容 |
| responsible_person | string | no | 负责人 |
| remark | string | no | 备注 |
| template_id | integer | no | 模板ID |
| trigger_type | string | no | 触发类型，如 time/usage/both |
| maintenance_items | array | no | 维护项目列表 |
| required_materials | array | no | 所需物料列表 |
| estimated_hours | number | no | 预估工时 |
| auto_generate_workorder | boolean | no | 是否自动生成工单 |
| current_usage | number | no | 当前累计使用量 |
| usage_threshold | number | no | 触发阈值 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_maintenance_plan
- Handler: updateMaintenancePlan
- Description: 更新预防性维护计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维护计划ID |
| plan_name | string | no | 计划名称 |
| maintenance_type | string | no | 维护类型 |
| cycle_type | string | no | 周期类型 |
| cycle_value | integer | no | 周期值 |
| next_maintenance_date | string | no | 下次维护日期 (YYYY-MM-DD) |
| maintenance_content | string | no | 维护内容 |
| responsible_person | string | no | 负责人 |
| status | string | no | 计划状态 |
| remark | string | no | 备注 |
| template_id | integer | no | 模板ID |
| trigger_type | string | no | 触发类型 |
| maintenance_items | array | no | 维护项目列表 |
| required_materials | array | no | 所需物料列表 |
| estimated_hours | number | no | 预估工时 |
| auto_generate_workorder | boolean | no | 是否自动生成工单 |
| current_usage | number | no | 当前累计使用量 |
| usage_threshold | number | no | 触发阈值 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## complete_maintenance_plan
- Handler: completeMaintenancePlan
- Description: 完成预防性维护计划，并自动写入维护日志

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维护计划ID |
| maintenance_date | string | no | 维护日期 (YYYY-MM-DD) |
| maintenance_person | string | no | 维护人员 |
| maintenance_content | string | no | 维护内容 |
| maintenance_cost | number | no | 维护成本 |
| parts_replaced | string | no | 更换部件 |
| remark | string | no | 备注 |
| actual_hours | number | no | 实际工时 |
| maintenance_result | string | no | 维护结果 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_maintenance_plan
- Handler: deleteMaintenancePlan
- Description: 删除预防性维护计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维护计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_maintenance_plan_history
- Handler: getMaintenancePlanHistory
- Description: 获取预防性维护计划历史记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维护计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_reminders
- Handler: listReminders
- Description: 获取维护提醒列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| status | string | no | 提醒状态 |
| start_date | string | no | 开始日期 (YYYY-MM-DD) |
| end_date | string | no | 结束日期 (YYYY-MM-DD) |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## send_reminder
- Handler: sendReminder
- Description: 发送维护提醒

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| plan_id | integer | yes | 维护计划ID |
| reminder_type | string | yes | 提醒类型 |
| recipient | string | no | 接收人 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## config_reminder
- Handler: configReminder
- Description: 配置维护提醒规则

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| plan_id | integer | yes | 维护计划ID |
| reminder_days | integer | yes | 提前提醒天数 |
| reminder_types | array | yes | 提醒类型列表 |
| recipient | string | no | 接收人 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## check_reminders
- Handler: checkReminders
- Description: 检查近期即将到期的维护计划提醒

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_maintenance_workorders
- Handler: listMaintenanceWorkorders
- Description: 获取维修工单列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| status | string | no | 状态 |
| priority | string | no | 优先级 |
| assigned_to | string | no | 负责人 |
| start_date | string | no | 开始日期 (YYYY-MM-DD) |
| end_date | string | no | 结束日期 (YYYY-MM-DD) |
| keyword | string | no | 关键词，匹配标题/描述/工单号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_maintenance_workorder
- Handler: getMaintenanceWorkorder
- Description: 获取单个维修工单详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_maintenance_workorder
- Handler: createMaintenanceWorkorder
- Description: 创建维修工单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| title | string | yes | 工单标题 |
| description | string | no | 工单描述 |
| priority | integer | no | 优先级 |
| planned_start_date | string | no | 计划开始日期 (YYYY-MM-DD) |
| planned_end_date | string | no | 计划结束日期 (YYYY-MM-DD) |
| estimated_hours | number | no | 预估工时 |
| assigned_to | string | no | 负责人 |
| materials | array | no | 材料清单 |
| labor_cost | number | no | 人工成本 |
| outsourcing_cost | number | no | 外包成本 |
| other_cost | number | no | 其他成本 |
| remark | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## assign_workorder
- Handler: assignWorkorder
- Description: 分配维修工单负责人

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| assigned_to | string | yes | 负责人 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## start_workorder
- Handler: startWorkorder
- Description: 开始维修工单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## complete_workorder
- Handler: completeWorkorder
- Description: 完成维修工单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| work_content | string | no | 维修内容 |
| actual_hours | number | no | 实际工时 |
| labor_cost | number | no | 人工成本 |
| outsourcing_cost | number | no | 外包成本 |
| other_cost | number | no | 其他成本 |
| materials | array | no | 材料清单 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## close_workorder
- Handler: closeWorkorder
- Description: 关闭维修工单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| remark | string | no | 关闭备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## cancel_workorder
- Handler: cancelWorkorder
- Description: 取消维修工单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| cancel_reason | string | no | 取消原因 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## add_workorder_materials
- Handler: addWorkorderMaterials
- Description: 向维修工单追加材料清单

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| materials | array | yes | 追加的材料清单 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_maintenance_requests
- Handler: listMaintenanceRequests
- Description: 获取故障维修申请列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| status | string | no | 申请状态 |
| fault_level | string | no | 故障等级 |
| start_date | string | no | 申请开始日期 (YYYY-MM-DD) |
| end_date | string | no | 申请结束日期 (YYYY-MM-DD) |
| keyword | string | no | 关键词，匹配申请单号/资产编号/资产名称/申请人 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_maintenance_request
- Handler: getMaintenanceRequest
- Description: 获取单个故障维修申请详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维修申请ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/requests/{id} | exact | GET /maintenance/requests/{id} | 获取维修申请详情 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: GET /maintenance/requests/{id}
- Summary: 获取维修申请详情
- Tags: 维修维护

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
## create_maintenance_request
- Handler: createMaintenanceRequest
- Description: 创建故障维修申请（通过 AI/skill 安全入口，单据仍进入待审批）

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| fault_description | string | yes | 故障描述 |
| fault_level | string | no | 故障等级 |
| request_date | string | no | 申请日期 (YYYY-MM-DD) |
| request_department | string | no | 报修部门 |
| contact_phone | string | no | 联系电话 |
| expected_repair_date | string | no | 期望完成日期 (YYYY-MM-DD) |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/ai/submit-request | fuzzy | POST /api/maintenance/ai/submit-request | 提交故障维修申请 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/maintenance/ai/submit-request
- Summary: 提交故障维修申请
- Tags: 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |
| fault_description | string | no | 故障描述 |
| fault_level | string | no | 故障等级 |
| request_department | string | no | 报修部门 |
| expected_repair_date | string | no | 期望维修日期 |

### Responses
#### 201
创建成功
#### 400
参数错误
#### 500
服务器错误
## approve_maintenance_request
- Handler: approveMaintenanceRequest
- Description: 审批故障维修申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维修申请ID |
| approved | boolean | no | 是否通过审批 |
| action | string | no | 兼容参数：approve 或 reject |
| comment | string | no | 审批意见 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/requests/{id}/approve | exact | POST /maintenance/requests/{id}/approve | 审批维修申请 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: POST /maintenance/requests/{id}/approve
- Summary: 审批维修申请
- Tags: 维修维护

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| approved | boolean | no |  |
| opinion | string | no |  |

### Responses
#### 200
审批完成
##### application/json
### Response Schema (200 application/json)
无
## start_maintenance_request
- Handler: startMaintenanceRequest
- Description: 开始执行故障维修申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维修申请ID |
| repair_person | string | yes | 维修人员 |
| repair_start_date | string | no | 开始维修日期 (YYYY-MM-DD) |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/requests/{id}/start | fuzzy | POST /api/maintenance/requests/{id}/start | 创建/提交 /api/maintenance/requests/{id}/start |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/maintenance/requests/{id}/start
- Summary: 创建/提交 /api/maintenance/requests/{id}/start
- Description: 自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: maintenance

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## complete_maintenance_request
- Handler: completeMaintenanceRequest
- Description: 完成故障维修申请，并自动沉淀维修日志

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 维修申请ID |
| repair_end_date | string | no | 完成维修日期 (YYYY-MM-DD) |
| repair_cost | number | no | 维修费用 |
| repair_content | string | no | 维修内容 |
| parts_replaced | string | no | 更换部件 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/requests/{id}/complete | fuzzy | POST /api/maintenance/requests/{id}/complete | 创建/提交 /api/maintenance/requests/{id}/complete |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/maintenance/requests/{id}/complete
- Summary: 创建/提交 /api/maintenance/requests/{id}/complete
- Description: 自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: maintenance

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_workorder_status
- Handler: updateWorkorderStatus
- Description: 更新维修工单状态

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 工单ID |
| status | string | yes | 新状态 |
| actual_start_time | string | no | 实际开始时间 |
| notes | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_usage_records
- Handler: listUsageRecords
- Description: 获取资产使用量记录列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| usage_type | string | no | 使用量类型 |
| start_date | string | no | 开始日期 (YYYY-MM-DD) |
| end_date | string | no | 结束日期 (YYYY-MM-DD) |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_usage_record
- Handler: createUsageRecord
- Description: 创建资产使用量记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| usage_date | string | yes | 使用日期 (YYYY-MM-DD) |
| usage_value | number | yes | 本次使用值 |
| usage_type | string | yes | 使用量类型 |
| cumulative_value | number | yes | 累计使用值 |
| operator | string | no | 记录人 |
| remark | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_usage_triggered
- Handler: listUsageTriggered
- Description: 获取使用量触发的维护记录列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| asset_code | string | no | 资产编号 |
| status | string | no | 处理状态 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## process_usage_triggered
- Handler: processUsageTriggered
- Description: 处理单个使用量触发记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 触发记录ID |
| work_order_id | integer | no | 关联工单ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_todo_tasks
- Handler: getTodoTasks

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## complete_task
- Handler: completeTask
- Description: 完成工作流任务。当前后端未开放该接口，调用时会返回明确错误。

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 任务ID |
| variables | object | no | 流程变量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_default_workflow
- Handler: getDefaultWorkflow
- Description: 获取当前租户默认资产流程

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /workflow/default | fuzzy | GET /api/workflow/default | 获取默认工作流ID |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/workflow/default
- Summary: 获取默认工作流ID
- Tags: 工作流

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| data.workflow_id | integer | no |  |

#### 500
服务器错误
## list_workflow_states
- Handler: listWorkflowStates
- Description: 获取当前租户默认资产流程的状态列表

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_workflow_transitions
- Handler: listWorkflowTransitions
- Description: 获取当前租户默认资产流程的迁移规则列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| from_state | string | no | 按来源状态筛选 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## apply_asset_transition
- Handler: applyAssetTransition
- Description: 对指定资产执行状态迁移

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_id | integer | no | 资产ID |
| asset_code | string | no | 资产编码；部分环境可替代 asset_id 使用 |
| transition_id | integer | yes | 迁移规则ID |
| reason | string | no | 迁移原因 |
| metadata | object | no | 附加元数据 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /workflow/transition/{assetRef} | fuzzy | POST /api/workflow/transition/{assetId} | 执行状态迁移 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/workflow/transition/{assetId}
- Summary: 执行状态迁移
- Description: 对资产执行工作流状态迁移
- Tags: 工作流

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetId | string | yes | 资产ID或编号 |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| transition_id | integer | yes | 迁移规则ID |
| reason | string | no | 迁移原因 |
| metadata | object | no | 附加元数据 |

### Responses
#### 200
迁移成功
#### 400
参数错误或状态不支持迁移
#### 404
资产或迁移规则不存在
#### 500
服务器错误
## list_asset_workflows
- Handler: listAssetWorkflows
- Description: 获取当前租户资产流程定义列表

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_asset_workflow
- Handler: getAssetWorkflow
- Description: 获取单个资产流程定义详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 流程ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_asset_workflow
- Handler: createAssetWorkflow
- Description: 创建资产流程定义

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes | 流程名称 |
| description | string | no | 流程描述 |
| status | string | no | 流程状态 |
| is_default | boolean | no | 是否设为默认流程 |
| items | object | no |  |
| items | object | no |  |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_asset_workflow
- Handler: updateAssetWorkflow
- Description: 更新资产流程定义

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 流程ID |
| name | string | no | 流程名称 |
| description | string | no | 流程描述 |
| status | string | no | 流程状态 |
| is_default | boolean | no | 是否设为默认流程 |
| items | object | no |  |
| items | object | no |  |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_asset_workflow
- Handler: deleteAssetWorkflow

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_departments
- Handler: listDepartments
- Description: 获取部门列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tree | boolean | no | 是否返回树形结构 |
| parent_id | integer | no | 父部门ID |
| include_children | boolean | no | 是否包含子部门 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /departments | fuzzy | GET /api/departments | 获取部门列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/departments
- Summary: 获取部门列表
- Description: 获取所有部门，支持关键词搜索和分页
- Tags: 部门管理

### Authentication
BearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| keyword | string | no | 关键词搜索（部门名称或编码） |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
部门列表
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].department_code | string | no |  |
| data[].department_name | string | no |  |
| data[].parent_code | string | no |  |
| data[].level | integer | no |  |
| data[].created_at | string | no |  |
| data[].updated_at | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

## list_users
- Handler: listUsers
- Description: 获取用户列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| role | string | no | 角色筛选 |
| department_code | string | no | 部门代码 |
| status | string | no | 状态：active/inactive/locked |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /users | fuzzy | GET /api/users | 查询 /api/users |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/users
- Summary: 查询 /api/users
- Description: 自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: users

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_current_auth_context
- Handler: getCurrentAuthContext
- Description: 根据当前调用凭证解析当前用户、角色、租户、菜单权限、角色权限和租户模块，用于让上层 AI 先确认权限边界后再执行查询或管理

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| include_menu_definitions | boolean | no | 是否同时返回可见菜单的定义明细，默认 false |
| include_module_details | boolean | no | 是否返回当前租户的模块明细，默认 true |
| include_role_permissions | boolean | no | 是否返回当前角色的权限列表，默认 true |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## query_department_asset_profile
- Handler: queryDepartmentAssetProfile
- Description: 组合查询科室/部门资产画像，返回资产规模、价值、状态结构、分类结构、位置结构、数据缺口、维护负荷及工单摘要，适合用于配置分析和部门画像

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| department | string | yes | 部门/科室名称或关键字 |
| keyword | string | no | 资产关键字，可选 |
| sample_limit | integer | no | 样本资产返回数量，默认 10，最大 20 |
| include_maintenance | boolean | no | 是否附带维护负荷摘要，默认 true |
| include_workorders | boolean | no | 是否附带维护工单摘要，默认 true |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## query_asset_operation_overview
- Handler: queryAssetOperationOverview
- Description: 组合查询资产或资产集合在维修、工单、调配、闲置、报废流程中的综合态势，适合用于异常链路和运营状态分析

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号，可选 |
| keyword | string | no | 资产关键词，可选 |
| department | string | no | 部门/科室名称或关键字，可选 |
| sample_limit | integer | no | 样本与事件返回数量，默认 10，最大 20 |
| include_idle | boolean | no | 是否包含闲置发布记录，默认 true |
| include_scrap | boolean | no | 是否包含报废记录，默认 true |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## query_workflow_pending_summary
- Handler: queryWorkflowPendingSummary
- Description: 组合查询当前租户待处理流程，汇总维护工单、调配、闲置发布、报废、盘点等模块的待办和堵塞点，适合流程健康分析

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| department | string | no | 部门/科室名称或关键字，可选 |
| keyword | string | no | 关键词，可选 |
| sample_limit | integer | no | 各模块返回的样本条数，默认 10，最大 20 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| status | string | no | 状态 |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## init_ai_conversation
- Handler: initAIConversation
- Description: 初始化AI对话

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/ai/init | fuzzy | POST /api/maintenance/ai/init | 初始化AI维修对话 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/maintenance/ai/init
- Summary: 初始化AI维修对话
- Tags: 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no | 对话类型 |
| userId | string | no | 用户ID |

### Responses
#### 200
成功
#### 500
服务器错误
## send_ai_message
- Handler: sendAIMessage
- Description: 发送消息到AI对话

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| conversation_id | string | yes | 对话ID |
| message | string | yes | 消息内容 |
| context | object | no | 上下文 |
| history | array | no | 历史消息 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /maintenance/ai/message | fuzzy | POST /api/maintenance/ai/message | 发送AI维修对话消息 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/maintenance/ai/message
- Summary: 发送AI维修对话消息
- Tags: 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| conversationId | string | yes | 对话ID |
| message | string | yes | 消息内容 |
| context | object | no | 对话上下文 |
| history | array&lt;unknown&gt; | no | 对话历史 |

### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## get_ai_pending
- Handler: getAIPending
- Description: 获取AI待处理请求

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/ai/pending | fuzzy | GET /api/maintenance/ai/pending | 获取AI待处理请求 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/maintenance/ai/pending
- Summary: 获取AI待处理请求
- Tags: 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
#### 500
服务器错误
## get_ai_analysis
- Handler: getAIAnalysis
- Description: 获取AI维修分析

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no | 分析类型 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |
| department | string | no | 部门 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| status | string | no | 状态 |
| department | string | no | 部门 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/ai/analysis | fuzzy | GET /api/maintenance/ai/analysis | 获取维修分析 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/maintenance/ai/analysis
- Summary: 获取维修分析
- Tags: 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no | 分析类型 |
| startDate | string | no | 开始日期 |
| endDate | string | no | 结束日期 |
| department | string | no | 部门 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
#### 500
服务器错误
## get_patient_volume_records
- Handler: getPatientVolumeRecords

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/patient-volume/records/all | fuzzy | GET /api/iot/patient-volume/records/all | 查询 /api/iot/patient-volume/records/all |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/patient-volume/records/all
- Summary: 查询 /api/iot/patient-volume/records/all
- Description: 自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_asset_usage_stats
- Handler: getAssetUsageStats

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/patient-volume/assets/usage-stats/all | fuzzy | GET /api/iot/patient-volume/assets/usage-stats/all | 查询 /api/iot/patient-volume/assets/usage-stats/all |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/patient-volume/assets/usage-stats/all
- Summary: 查询 /api/iot/patient-volume/assets/usage-stats/all
- Description: 自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_procurements
- Handler: listProcurements

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /procurement/requests | exact | GET /procurement/requests | 获取采购单列表 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: GET /procurement/requests
- Summary: 获取采购单列表
- Tags: 采购管理

### Authentication
无
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | no |  |
| keyword | string | no |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
#### 400
未选择租户
##### application/json
### Response Schema (400 application/json)
无
## create_procurement
- Handler: createProcurement
- Description: 创建采购申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_name | string | yes | 资产名称 |
| category_id | integer | no | 类别ID |
| quantity | integer | no | 数量 |
| estimated_cost | number | no | 预估费用 |
| department | string | yes | 需求部门 |
| reason | string | yes | 采购原因 |
| expected_date | string | no | 期望日期 |
| specification | string | no | 规格要求 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /procurement/requests | exact | POST /procurement/requests | 创建采购单 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: POST /procurement/requests
- Summary: 创建采购单
- Tags: 采购管理

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | yes |  |
| department | string | no |  |
| applicant | string | no |  |
| budget | number | no |  |
| remark | string | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
## approve_procurement
- Handler: approveProcurement
- Description: 审批采购申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 采购ID |
| action | string | yes | 操作：approve/reject |
| comment | string | no | 审批意见 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| asset_code | string | no | 资产编号 |
| status | string | no | 状态 |
| qc_type | string | no | 质检类型 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /procurement/requests/{id}/approve | exact | PUT /procurement/requests/{id}/approve | 审批采购单 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: PUT /procurement/requests/{id}/approve
- Summary: 审批采购单
- Tags: 采购管理

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| approved | boolean | no |  |
| opinion | string | no |  |

### Responses
#### 200
审批结果
##### application/json
### Response Schema (200 application/json)
无
## list_quality_controls
- Handler: listQualityControls

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /quality-control | fuzzy | GET /quality-control/quality-control | 获取质量控制记录列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /quality-control/quality-control
- Summary: 获取质量控制记录列表
- Tags: 质量管理

### Authentication
无
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no |  |
| pageSize | integer | no |  |
| qc_type | string | no |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
## create_quality_control
- Handler: createQualityControl
- Description: 创建质检记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| qc_type | string | yes | 质检类型 |
| qc_date | string | yes | 质检日期 |
| qc_person | string | yes | 质检人员 |
| result | string | yes | 质检结果 |
| finding | string | no | 发现问题 |
| action_required | string | no | 需处理事项 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /quality-control | fuzzy | POST /quality-control/quality-control | 创建质量控制记录 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /quality-control/quality-control
- Summary: 创建质量控制记录
- Tags: 质量管理

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes |  |
| qc_type | string | yes |  |
| qc_date | string | yes |  |
| result | string | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
## get_quality_statistics
- Handler: getQualityStatistics
- Description: 获取质检统计信息

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |
| department | string | no | 部门 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| category_id | integer | no | 类别ID |
| warehouse | string | no | 仓库 |
| status | string | no | 状态 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /quality-control/statistics | fuzzy | GET /quality-control/quality-control/statistics | 获取质量控制统计 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /quality-control/quality-control/statistics
- Summary: 获取质量控制统计
- Tags: 质量管理

### Authentication
无
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| start_date | string | no |  |
| end_date | string | no |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
无
## list_inventory
- Handler: listInventory

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /inventory | fuzzy | GET /api/inventory | 查询 /api/inventory |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/inventory
- Summary: 查询 /api/inventory
- Description: 自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: inventory

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## create_inventory_record
- Handler: createInventoryRecord
- Description: 创建库存记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| item_name | string | yes | 物品名称 |
| category_id | integer | no | 类别ID |
| quantity | integer | yes | 数量 |
| unit | string | no | 单位 |
| warehouse | string | no | 仓库 |
| location | string | no | 存放位置 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /inventory | fuzzy | POST /api/inventory | 创建/提交 /api/inventory |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/inventory
- Summary: 创建/提交 /api/inventory
- Description: 自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: inventory

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## adjust_inventory
- Handler: adjustInventory
- Description: 调整库存数量

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 库存ID |
| adjust_type | string | yes | 调整类型：in/out/adj |
| quantity | integer | yes | 调整数量 |
| reason | string | yes | 调整原因 |
| remark | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /inventory/{id}/adjust | fuzzy | PUT /api/inventory/{id} | 更新 /api/inventory/{id} |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/inventory/{id}
- Summary: 更新 /api/inventory/{id}
- Description: 自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: inventory

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_inventory_plans
- Handler: listInventoryPlans
- Description: 获取盘点计划列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| status | string | no | 计划状态 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_inventory_plan
- Handler: getInventoryPlan
- Description: 获取单个盘点计划详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_inventory_plan
- Handler: createInventoryPlan
- Description: 创建盘点计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| plan_no | string | yes | 计划编号 |
| plan_name | string | yes | 计划名称 |
| start_date | string | no | 开始日期 (YYYY-MM-DD) |
| end_date | string | no | 结束日期 (YYYY-MM-DD) |
| status | string | no | 计划状态，默认 draft |
| remark | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_inventory_plan
- Handler: updateInventoryPlan
- Description: 更新盘点计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |
| plan_no | string | yes | 计划编号 |
| plan_name | string | yes | 计划名称 |
| start_date | string | no | 开始日期 (YYYY-MM-DD) |
| end_date | string | no | 结束日期 (YYYY-MM-DD) |
| status | string | no | 计划状态 |
| remark | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## activate_inventory_plan
- Handler: activateInventoryPlan
- Description: 激活盘点计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## complete_inventory_plan
- Handler: completeInventoryPlan
- Description: 完成盘点计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## cancel_inventory_plan
- Handler: cancelInventoryPlan
- Description: 取消盘点计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_inventory_tasks
- Handler: listInventoryTasks
- Description: 获取盘点任务列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| inventory_id | integer | no | 盘点记录ID |
| assignee | string | no | 负责人用户名 |
| status | string | no | 任务状态 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_inventory_task
- Handler: getInventoryTask
- Description: 获取单个盘点任务详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_inventory_task
- Handler: createInventoryTask
- Description: 创建盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inventory_id | integer | yes | 盘点记录ID |
| task_name | string | yes | 任务名称 |
| assignee | string | yes | 负责人用户名 |
| assignee_name | string | yes | 负责人姓名 |
| department_code | string | no | 部门编码 |
| location | string | no | 盘点位置 |
| estimated_count | integer | no | 预估盘点数量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## assign_inventory_task
- Handler: assignInventoryTask
- Description: 分配盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## start_inventory_task
- Handler: startInventoryTask
- Description: 开始盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## complete_inventory_task
- Handler: completeInventoryTask
- Description: 完成盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |
| actual_count | integer | no | 实际盘点数量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_inventory_task
- Handler: updateInventoryTask
- Description: 更新盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |
| task_name | string | yes | 任务名称 |
| assignee | string | yes | 负责人用户名 |
| assignee_name | string | yes | 负责人姓名 |
| department_code | string | no | 部门编码 |
| location | string | no | 盘点位置 |
| estimated_count | integer | no | 预估盘点数量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## cancel_inventory_task
- Handler: cancelInventoryTask
- Description: 取消盘点任务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_inventory_discrepancies
- Handler: listInventoryDiscrepancies
- Description: 获取盘点差异列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| inventory_id | integer | no | 盘点记录ID |
| asset_code | string | no | 资产编号 |
| handling_status | string | no | 处理状态 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_inventory_discrepancy
- Handler: getInventoryDiscrepancy
- Description: 获取单个盘点差异详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点差异ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## handle_inventory_discrepancy
- Handler: handleInventoryDiscrepancy
- Description: 处理单个盘点差异

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点差异ID |
| handling_status | string | yes | 处理状态 |
| handling_method | string | yes | 处理方式 |
| handling_notes | string | no | 处理备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## batch_handle_inventory_discrepancies
- Handler: batchHandleInventoryDiscrepancies
- Description: 批量处理盘点差异

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | array | yes |  |
| items | integer | no |  |
| handling_status | string | yes | 处理状态 |
| handling_method | string | yes | 处理方式 |
| handling_notes | string | no | 处理备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_inventory_discrepancy_statistics
- Handler: getInventoryDiscrepancyStatistics
- Description: 获取指定盘点记录的差异统计

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inventory_id | integer | yes | 盘点记录ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## generate_inventory_discrepancies
- Handler: generateInventoryDiscrepancies
- Description: 根据盘点明细自动生成差异记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inventory_id | integer | yes | 盘点记录ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_scrappings
- Handler: listScrappings

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /scrapping | fuzzy | GET /api/scrapping | 查询 /api/scrapping |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/scrapping
- Summary: 查询 /api/scrapping
- Description: 自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: scrapping

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## create_scrapping
- Handler: createScrapping
- Description: 创建报废申请

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| reason | string | yes | 报废原因 |
| description | string | no | 详细说明 |
| estimated_value | number | no | 预估残值 |
| apply_date | string | no | 申请日期 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /scrapping | fuzzy | POST /api/scrapping | 创建/提交 /api/scrapping |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/scrapping
- Summary: 创建/提交 /api/scrapping
- Description: 自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: scrapping

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## approve_scrapping
- Handler: approveScrapping

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /scrapping/{id}/approve | fuzzy | PUT /api/scrapping/{id} | 更新 /api/scrapping/{id} |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/scrapping/{id}
- Summary: 更新 /api/scrapping/{id}
- Description: 自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: scrapping

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_acceptances
- Handler: listAcceptances

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /acceptance | fuzzy | GET /api/acceptance/records | 查询 /api/acceptance/records |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/acceptance/records
- Summary: 查询 /api/acceptance/records
- Description: 自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: acceptance

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## create_acceptance
- Handler: createAcceptance

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /acceptance | fuzzy | POST /api/acceptance/records | 创建/提交 /api/acceptance/records |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/acceptance/records
- Summary: 创建/提交 /api/acceptance/records
- Description: 自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: acceptance

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_dashboard_overview
- Handler: getDashboardOverview

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/statistics/overview | fuzzy | GET /api/assets/statistics/overview | 查询 /api/assets/statistics/overview |
| GET /transfer/statistics | fuzzy | GET /api/transfer/statistics | 查询 /api/transfer/statistics |
| GET /idle/statistics | fuzzy | GET /api/idle/statistics | 查询 /api/idle/statistics |

### Request Detail 1
- MCP Request: GET /assets/statistics/overview

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/statistics/overview
- Summary: 查询 /api/assets/statistics/overview
- Description: 自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
### Request Detail 2
- MCP Request: GET /transfer/statistics

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/transfer/statistics
- Summary: 查询 /api/transfer/statistics
- Description: 自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: transfer

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
### Request Detail 3
- MCP Request: GET /idle/statistics

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/idle/statistics
- Summary: 查询 /api/idle/statistics
- Description: 自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: idle

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_asset_age_distribution
- Handler: getAssetAgeDistribution
- Description: 获取资产使用年限分布

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| department | string | no | 部门 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /assets/statistics/age-distribution | fuzzy | GET /api/assets/statistics/overview | 查询 /api/assets/statistics/overview |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/assets/statistics/overview
- Summary: 查询 /api/assets/statistics/overview
- Description: 自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: assets

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_maintenance_cost_analysis
- Handler: getMaintenanceCostAnalysis

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /maintenance/costs/analysis | fuzzy | GET /api/maintenance/costs/analysis | 查询 /api/maintenance/costs/analysis |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/maintenance/costs/analysis
- Summary: 查询 /api/maintenance/costs/analysis
- Description: 自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: maintenance

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## create_user
- Handler: createUser
- Description: 创建用户账号

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | yes | 用户名 |
| real_name | string | yes | 真实姓名 |
| password | string | yes | 密码 |
| role | string | yes | 角色 |
| email | string | no | 邮箱 |
| phone | string | no | 电话 |
| department_code | string | no | 部门代码 |
| status | string | no | 状态 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /users | fuzzy | POST /api/users | 创建/提交 /api/users |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/users
- Summary: 创建/提交 /api/users
- Description: 自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: users

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_user
- Handler: updateUser
- Description: 更新用户信息

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 用户ID |
| real_name | string | no | 真实姓名 |
| email | string | no | 邮箱 |
| phone | string | no | 电话 |
| department_code | string | no | 部门代码 |
| status | string | no | 状态 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /users/{id} | fuzzy | PUT /api/users/{id} | 更新 /api/users/{id} |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/users/{id}
- Summary: 更新 /api/users/{id}
- Description: 自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: users

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## reset_user_password
- Handler: resetUserPassword
- Description: 重置用户密码

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 用户ID |
| old_password | string | no | 旧密码。管理员重置时可不传。 |
| new_password | string | yes | 新密码 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /users/{id}/change-password | fuzzy | PUT /api/users/{id}/change-password | 更新 /api/users/{id}/change-password |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/users/{id}/change-password
- Summary: 更新 /api/users/{id}/change-password
- Description: 自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: users

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## assign_user_role
- Handler: assignUserRole
- Description: 分配用户角色

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| user_id | integer | yes | 用户ID |
| tenant_id | integer | no | 租户ID，不传时默认使用当前 MCP 客户端租户 |
| role | string | yes | 角色名称 |
| is_default | boolean | no | 是否设为默认角色 |
| keyword | string | no | 搜索关键词 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /users/{userID}/roles | fuzzy | POST /api/users/{id}/roles | 创建/提交 /api/users/{id}/roles |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/users/{id}/roles
- Summary: 创建/提交 /api/users/{id}/roles
- Description: 自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: users

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_roles
- Handler: listRoles

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /roles-permissions/roles | fuzzy | GET /api/roles-permissions/roles | 查询 /api/roles-permissions/roles |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/roles-permissions/roles
- Summary: 查询 /api/roles-permissions/roles
- Description: 自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: roles-permissions

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_role_permissions
- Handler: getRolePermissions
- Description: 获取角色权限详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | string | yes | 角色名称 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /roles-permissions/roles/{role}/permissions | fuzzy | GET /api/roles-permissions/roles/{role}/permissions | 查询 /api/roles-permissions/roles/{role}/permissions |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/roles-permissions/roles/{role}/permissions
- Summary: 查询 /api/roles-permissions/roles/{role}/permissions
- Description: 自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: roles-permissions

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## create_role
- Handler: createRole
- Description: 创建角色

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role_code | string | yes | 角色代码 |
| role_name | string | yes | 角色名称 |
| name | string | no | 兼容旧参数，将作为 role_code/role_name 回退值 |
| description | string | no | 角色描述 |
| permissions | array | no | 创建成功后附加写入的权限列表 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /roles-permissions/roles | fuzzy | POST /api/roles-permissions/roles | 创建/提交 /api/roles-permissions/roles |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/roles-permissions/roles
- Summary: 创建/提交 /api/roles-permissions/roles
- Description: 自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: roles-permissions

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_role_permissions
- Handler: updateRolePermissions
- Description: 更新角色权限

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | string | yes | 角色名称 |
| permissions | array | yes | 新的权限列表 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /roles-permissions/roles/{role}/permissions | fuzzy | PUT /api/roles-permissions/roles/{role}/permissions | 更新 /api/roles-permissions/roles/{role}/permissions |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/roles-permissions/roles/{role}/permissions
- Summary: 更新 /api/roles-permissions/roles/{role}/permissions
- Description: 自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: roles-permissions

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_system_config
- Handler: getSystemConfig

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /system-config/database | fuzzy | GET /api/system-config/database | 查询 /api/system-config/database |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/system-config/database
- Summary: 查询 /api/system-config/database
- Description: 自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: system-config

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_system_config
- Handler: updateSystemConfig
- Description: 更新数据库连接配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| host | string | yes | 数据库主机 |
| port | integer | yes | 数据库端口 |
| user | string | yes | 数据库用户名 |
| password | string | no | 数据库密码，不传则沿用当前配置 |
| database | string | yes | 数据库名称 |
| connectionLimit | integer | no | 连接池大小 |
| connectTimeout | integer | no | 连接超时（毫秒） |
| idleTimeout | integer | no | 空闲超时（毫秒） |
| maxIdle | integer | no | 最大空闲连接数 |
| category | string | no | 模块分类 |
| type | string | no | 模块类型 |
| status | string | no | 状态筛选 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /system-config/database | fuzzy | PUT /api/system-config/database | 更新 /api/system-config/database |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/system-config/database
- Summary: 更新 /api/system-config/database
- Description: 自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: system-config

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_modules
- Handler: listModules

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_module_config
- Handler: getModuleConfig
- Description: 获取模块配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_module_config
- Handler: updateModuleConfig
- Description: 更新模块配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| config | object | yes | 配置JSON |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /module-configs/{moduleID} | exact | PUT /module-configs/{moduleId} | 更新单模块租户配置 |

### Matched Backend Endpoint
- Match: exact
- Endpoint: PUT /module-configs/{moduleId}
- Summary: 更新单模块租户配置
- Tags: 模块管理

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenant_id | integer | no |  |
| enabled | boolean | no |  |
| config | object | no |  |

### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## validate_module_config
- Handler: validateModuleConfig
- Description: 验证模块配置是否符合模块 schema

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| config | object | yes | 待验证的配置 JSON |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## enable_module
- Handler: enableModule
- Description: 启用指定模块，可选同时写入配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| config | object | no | 启用时写入的模块配置 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## disable_module
- Handler: disableModule
- Description: 禁用指定模块

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_module_versions
- Handler: listModuleVersions
- Description: 获取模块配置版本历史

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_module_version
- Handler: createModuleVersion
- Description: 创建模块配置版本

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| config | object | yes | 配置 JSON |
| change_log | string | no | 变更说明 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## rollback_module_version
- Handler: rollbackModuleVersion
- Description: 回滚模块配置到指定版本

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| version_id | integer | yes | 版本ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## compare_module_version
- Handler: compareModuleVersion
- Description: 对比指定模块版本与当前版本的差异

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| version_id | integer | yes | 版本ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_module_version
- Handler: deleteModuleVersion
- Description: 删除模块历史配置版本，不能删除当前版本

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| version_id | integer | yes | 版本ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## backup_module_config
- Handler: backupModuleConfig
- Description: 备份模块当前配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## restore_module_config
- Handler: restoreModuleConfig
- Description: 使用备份数据恢复模块配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| backup_data | object | yes | 备份数据对象 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_module_menus
- Handler: listModuleMenus
- Description: 获取模块菜单权限列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | yes | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_module_menus
- Handler: updateModuleMenus
- Description: 更新模块菜单权限

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| module_id | string | no | 模块ID |
| module_code | string | no | 兼容旧参数，等同于 module_id |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| user_id | integer | no | 用户ID |
| action | string | no | 操作类型 |
| resource | string | no | 资源类型 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_audit_logs
- Handler: listAuditLogs

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /audit-logs | fuzzy | GET /api/audit-logs | 获取操作日志列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/audit-logs
- Summary: 获取操作日志列表
- Description: 获取操作日志列表，支持分页、筛选和搜索。只有系统管理员可以查看所有日志，其他角色只能查看自己的操作日志。
- Tags: 操作日志（审计）

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| user_id | integer | no | 用户ID筛选 |
| username | string | no | 用户名筛选 |
| action_type | enum(create, update, delete, login, logout, view, export, import, approve, reject, link, unlink) | no | 操作类型筛选 |
| module | string | no | 模块筛选（assets, users, technical-documents等） |
| resource_type | string | no | 资源类型筛选 |
| resource_id | integer | no | 资源ID筛选 |
| start_date | string | no | 开始日期（YYYY-MM-DD） |
| end_date | string | no | 结束日期（YYYY-MM-DD） |
| keyword | string | no | 关键词搜索（操作描述、资源名称） |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
获取成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].user_id | integer | no |  |
| data[].username | string | no |  |
| data[].real_name | string | no |  |
| data[].role | string | no |  |
| data[].action_type | string | no |  |
| data[].module | string | no |  |
| data[].resource_type | string | no |  |
| data[].resource_id | integer | no |  |
| data[].resource_name | string | no |  |
| data[].action_description | string | no |  |
| data[].ip_address | string | no |  |
| data[].request_method | string | no |  |
| data[].request_path | string | no |  |
| data[].response_status | integer | no |  |
| data[].execution_time | integer | no |  |
| data[].created_at | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 401
未授权
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## get_audit_log_detail
- Handler: getAuditLogDetail
- Description: 获取审计日志详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 日志ID |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| status | string | no | 状态 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /audit-logs/{id} | fuzzy | GET /api/audit-logs | 获取操作日志列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/audit-logs
- Summary: 获取操作日志列表
- Description: 获取操作日志列表，支持分页、筛选和搜索。只有系统管理员可以查看所有日志，其他角色只能查看自己的操作日志。
- Tags: 操作日志（审计）

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| user_id | integer | no | 用户ID筛选 |
| username | string | no | 用户名筛选 |
| action_type | enum(create, update, delete, login, logout, view, export, import, approve, reject, link, unlink) | no | 操作类型筛选 |
| module | string | no | 模块筛选（assets, users, technical-documents等） |
| resource_type | string | no | 资源类型筛选 |
| resource_id | integer | no | 资源ID筛选 |
| start_date | string | no | 开始日期（YYYY-MM-DD） |
| end_date | string | no | 结束日期（YYYY-MM-DD） |
| keyword | string | no | 关键词搜索（操作描述、资源名称） |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
获取成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].user_id | integer | no |  |
| data[].username | string | no |  |
| data[].real_name | string | no |  |
| data[].role | string | no |  |
| data[].action_type | string | no |  |
| data[].module | string | no |  |
| data[].resource_type | string | no |  |
| data[].resource_id | integer | no |  |
| data[].resource_name | string | no |  |
| data[].action_description | string | no |  |
| data[].ip_address | string | no |  |
| data[].request_method | string | no |  |
| data[].request_path | string | no |  |
| data[].response_status | integer | no |  |
| data[].execution_time | integer | no |  |
| data[].created_at | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 401
未授权
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## list_tenants
- Handler: listTenants

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /tenants | fuzzy | GET /api/tenants | 查询 /api/tenants |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/tenants
- Summary: 查询 /api/tenants
- Description: 自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: tenants

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_tenant_config
- Handler: getTenantConfig
- Description: 获取租户配置

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenant_id | integer | yes | 租户ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /tenants/{tenantID}/config | fuzzy | GET /chat/config | 查询 /chat/config |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /chat/config
- Summary: 查询 /chat/config
- Description: 自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: chat

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_tenant_modules
- Handler: updateTenantModules

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /tenants/{tenantID}/modules | fuzzy | PUT /api/tenant-module-config/tenants/{tenantId}/modules | 更新企业空间的模块配置 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/tenant-module-config/tenants/{tenantId}/modules
- Summary: 更新企业空间的模块配置
- Tags: TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenantId | string | yes | 企业空间ID |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].module_id | string | no |  |
| items[].enabled | boolean | no |  |
| items[].config | object | no |  |

### Responses
#### 200
成功更新模块配置
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |

## list_iot_devices
- Handler: listIoTDevices
- Description: 获取IoT设备列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| device_type | string | no | 设备类型 |
| status | string | no | 状态 |
| location | string | no | 位置 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/devices | fuzzy | GET /api/iot/devices | 查询 /api/iot/devices |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/devices
- Summary: 查询 /api/iot/devices
- Description: 自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_device
- Handler: getDevice
- Description: 获取设备详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 设备主键ID |
| device_id | string | no | 设备业务ID |
| device_code | string | no | 兼容旧参数，等同于 device_id |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/devices/{idOrCode} | fuzzy | GET /api/iot/devices | 查询 /api/iot/devices |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/devices
- Summary: 查询 /api/iot/devices
- Description: 自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## register_device
- Handler: registerDevice
- Description: 注册IoT设备

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | no | 设备业务ID，推荐使用 |
| device_code | string | no | 兼容旧参数，等同于 device_id |
| device_name | string | yes | 设备名称 |
| device_type | string | yes | 设备类型 |
| manufacturer | string | no | 制造商 |
| model | string | no | 设备型号 |
| serial_number | string | no | 序列号 |
| mac_address | string | no | MAC 地址 |
| firmware_version | string | no | 固件版本 |
| status | string | no | 设备状态 |
| remark | string | no | 备注 |
| asset_code | string | no | 创建设备后自动关联的资产编号 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /iot/devices | fuzzy | POST /api/iot/devices | 创建/提交 /api/iot/devices |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/iot/devices
- Summary: 创建/提交 /api/iot/devices
- Description: 自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## update_device_status
- Handler: updateDeviceStatus
- Description: 更新设备状态

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 设备ID |
| status | string | yes | 新状态 |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_asset_location
- Handler: getAssetLocation

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/location/assets/{assetCode}/location | fuzzy | GET /api/iot/location/assets/{assetCode}/location | 查询 /api/iot/location/assets/{assetCode}/location |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/location/assets/{assetCode}/location
- Summary: 查询 /api/iot/location/assets/{assetCode}/location
- Description: 自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetCode | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_location_history
- Handler: getLocationHistory
- Description: 获取资产位置历史

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| start_time | string | no | 开始时间 |
| end_time | string | no | 结束时间 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /iot/location/assets/{assetCode}/location/history | fuzzy | GET /api/iot/location/assets/{assetCode}/location/history | 查询 /api/iot/location/assets/{assetCode}/location/history |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/iot/location/assets/{assetCode}/location/history
- Summary: 查询 /api/iot/location/assets/{assetCode}/location/history
- Description: 自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: iot

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetCode | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_assets_in_area
- Handler: listAssetsInArea
- Description: 查询指定区域内的资产

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| minLatitude | number | no | 区域最小纬度 |
| maxLatitude | number | no | 区域最大纬度 |
| minLongitude | number | no | 区域最小经度 |
| maxLongitude | number | no | 区域最大经度 |
| floor_number | integer | no | 楼层号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## report_device_location_data
- Handler: reportDeviceLocationData
- Description: 上报设备定位数据到资产位置服务

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 设备业务ID |
| latitude | number | no | 纬度 |
| longitude | number | no | 经度 |
| altitude | number | no | 海拔 |
| signal_strength | integer | no | 信号强度 |
| battery_level | integer | no | 电量百分比 |
| other_data | object | no | 扩展原始数据 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## report_beacon_location
- Handler: reportBeaconLocation
- Description: 上报 Beacon 设备当前位置编码

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 信标设备业务ID |
| location_code | string | yes | 位置编码 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_beacon_assets
- Handler: listBeaconAssets
- Description: 获取已关联 Beacon 设备的资产列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| device_type | string | no | 设备类型 |
| status | string | no | 设备状态 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| is_active | boolean | no | 是否激活 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_location_codes
- Handler: listLocationCodes

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_location_code
- Handler: getLocationCode
- Description: 获取位置编码详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 位置编码ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_location_code
- Handler: createLocationCode
- Description: 创建位置编码

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| location_code | string | yes | 位置编号 |
| location_name | string | yes | 位置名称 |
| description | string | no | 位置描述 |
| building_name | string | no | 建筑物名称 |
| floor_number | integer | no | 楼层号 |
| room_number | string | no | 房间号 |
| area_name | string | no | 区域名称 |
| latitude | number | no | 纬度 |
| longitude | number | no | 经度 |
| is_active | boolean | no | 是否激活 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_location_code
- Handler: updateLocationCode
- Description: 更新位置编码

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 位置编码ID |
| location_code | string | no | 位置编号 |
| location_name | string | no | 位置名称 |
| description | string | no | 位置描述 |
| building_name | string | no | 建筑物名称 |
| floor_number | integer | no | 楼层号 |
| room_number | string | no | 房间号 |
| area_name | string | no | 区域名称 |
| latitude | number | no | 纬度 |
| longitude | number | no | 经度 |
| is_active | boolean | no | 是否激活 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_location_code
- Handler: deleteLocationCode
- Description: 删除位置编码

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 位置编码ID |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| is_handled | boolean | no | 是否已处理 |
| alert_type | string | no | 告警类型 |
| alert_level | string | no | 告警等级 |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_location_alerts
- Handler: listLocationAlerts

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_location_alert_stats
- Handler: getLocationAlertStats
- Description: 获取位置告警统计

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## handle_location_alert
- Handler: handleLocationAlert
- Description: 处理单个位置告警

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 告警ID |
| handle_result | string | no | 处理结果 |
| remark | string | no | 备注 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## batch_handle_location_alerts
- Handler: batchHandleLocationAlerts
- Description: 批量处理位置告警

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | integer | no |  |
| handle_result | string | no | 处理结果 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_location_alert
- Handler: deleteLocationAlert
- Description: 删除位置告警

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 告警ID |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| zone_id | integer | no | 区域ID |
| start_time | string | no | 开始时间 |
| end_time | string | no | 结束时间 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_records
- Handler: getEnvironmentRecords

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_alerts
- Handler: getEnvironmentAlerts
- Description: 旧版占位工具：当前主服务没有通用环境告警列表接口，请改用位置告警或环境监测新工具

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| severity | string | no | 严重程度 |
| status | string | no | 状态 |
| zone_id | integer | no | 区域ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_latest_by_device
- Handler: getEnvironmentLatestByDevice
- Description: 按设备获取最新环境监测数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 设备业务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_latest_by_asset
- Handler: getEnvironmentLatestByAsset
- Description: 按资产获取最新环境监测数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_asset_series
- Handler: getEnvironmentAssetSeries
- Description: 获取资产环境监测时序数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| start_time | string | no | 开始时间 |
| end_time | string | no | 结束时间 |
| limit | integer | no | 最大返回条数 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_pipeline_health
- Handler: getEnvironmentPipelineHealth
- Description: 获取环境监测管道健康状态

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_environment_pipeline_docs
- Handler: getEnvironmentPipelineDocs
- Description: 获取环境监测管道接口说明

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 设备业务ID |
| asset_code | string | no | 资产编号 |
| location_code | string | no | 位置编码 |
| area_name | string | no | 区域名称 |
| building_name | string | no | 建筑物名称 |
| floor_number | integer | no | 楼层号 |
| rssi | integer | no | RSSI 信号强度 |
| accuracy | number | no | 定位精度 |
| battery_level | integer | no | 电量百分比 |
| event_time | string | no | 事件时间，建议 ISO8601 |
| payload | object | no | 原始扩展载荷 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## ingest_zone_location_sample
- Handler: ingestZoneLocationSample

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## ingest_zone_location_batch
- Handler: ingestZoneLocationBatch
- Description: 批量写入区域定位数据（硬件/网关 ingest 接口；常规 Web 登录态通常不可直接替代 IoT 上报 token）

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 设备业务ID |
| asset_code | string | no | 资产编号 |
| location_code | string | no | 位置编码 |
| area_name | string | no | 区域名称 |
| building_name | string | no | 建筑物名称 |
| floor_number | integer | no | 楼层号 |
| rssi | integer | no | RSSI 信号强度 |
| accuracy | number | no | 定位精度 |
| battery_level | integer | no | 电量百分比 |
| event_time | string | no | 事件时间，建议 ISO8601 |
| payload | object | no | 原始扩展载荷 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_zone_location_latest_by_device
- Handler: getZoneLocationLatestByDevice
- Description: 按设备获取最新区域定位时序数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| device_id | string | yes | 设备业务ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_zone_location_latest_by_asset
- Handler: getZoneLocationLatestByAsset
- Description: 按资产获取最新区域定位时序数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_zone_location_asset_series
- Handler: getZoneLocationAssetSeries
- Description: 获取资产区域定位时序数据

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |
| start_time | string | no | 开始时间 |
| end_time | string | no | 结束时间 |
| limit | integer | no | 最大返回条数 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_zone_location_pipeline_health
- Handler: getZoneLocationPipelineHealth
- Description: 获取区域定位管道健康状态

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_zone_location_pipeline_docs
- Handler: getZoneLocationPipelineDocs
- Description: 获取区域定位管道接口说明

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| alert_type | string | no | 告警类型 |
| severity | string | no | 严重程度 |
| status | string | no | 状态 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_alerts
- Handler: listAlerts

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## acknowledge_alert
- Handler: acknowledgeAlert
- Description: 确认告警

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| comment | string | no | 处理说明 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /intelligent-alerts/{param1}/read | fuzzy | POST /api/intelligent-alerts/{alertId}/read | 标记单条预警已读 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/intelligent-alerts/{alertId}/read
- Summary: 标记单条预警已读
- Tags: 智能预警

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| alertId | string | yes | 预警ID |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no | 预警类型 |

### Responses
#### 200
成功
#### 400
失败
#### 500
服务器错误
## resolve_alert
- Handler: resolveAlert
- Description: 解决告警

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| comment | string | no | 解决说明 |
| asset_code | string | no | 资产编号 |
| patient_id | string | no | 患者ID |
| keyword | string | no | 搜索关键词 |
| start_time | string | no | 开始时间 |
| end_time | string | no | 结束时间 |
| batch_size | integer | no | 每批次查询数量 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /intelligent-alerts/{param1}/handle | fuzzy | POST /api/intelligent-alerts/{alertId}/handle | 标记单条预警已处理 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/intelligent-alerts/{alertId}/handle
- Summary: 标记单条预警已处理
- Tags: 智能预警

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| alertId | string | yes | 预警ID |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no |  |
| handlerNotes | string | no | 处理备注 |

### Responses
#### 200
成功
#### 400
失败
#### 500
服务器错误
## list_documents
- Handler: listDocuments

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /technical-documents | fuzzy | GET /api/technical-documents | 获取技术资料列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/technical-documents
- Summary: 获取技术资料列表
- Description: 获取技术资料列表，支持分页、关键词搜索、分类筛选等
- Tags: 技术资料管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| keyword | string | no | 关键词搜索（标题、描述、文件名） |
| category | string | no | 分类筛选 |
| asset_type | string | no | 资产类型筛选 |
| brand | string | no | 品牌筛选 |
| status | enum(active, archived, deleted) | no | 状态筛选 |
| review_status | enum(pending, approved, rejected) | no | 审核状态筛选（不指定时，active 状态默认只显示 approved） |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
获取成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].title | string | no |  |
| data[].file_name | string | no |  |
| data[].file_path | string | no |  |
| data[].category | string | no |  |
| data[].brand | string | no |  |
| data[].model | string | no |  |
| data[].review_status | enum(pending, approved, rejected) | no |  |
| data[].uploaded_by | string | no |  |
| data[].upload_date | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 401
未授权
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## get_document
- Handler: getDocument
- Description: 获取文档详情

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /technical-documents/{id} | fuzzy | GET /api/technical-documents | 获取技术资料列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/technical-documents
- Summary: 获取技术资料列表
- Description: 获取技术资料列表，支持分页、关键词搜索、分类筛选等
- Tags: 技术资料管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| keyword | string | no | 关键词搜索（标题、描述、文件名） |
| category | string | no | 分类筛选 |
| asset_type | string | no | 资产类型筛选 |
| brand | string | no | 品牌筛选 |
| status | enum(active, archived, deleted) | no | 状态筛选 |
| review_status | enum(pending, approved, rejected) | no | 审核状态筛选（不指定时，active 状态默认只显示 approved） |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
获取成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].title | string | no |  |
| data[].file_name | string | no |  |
| data[].file_path | string | no |  |
| data[].category | string | no |  |
| data[].brand | string | no |  |
| data[].model | string | no |  |
| data[].review_status | enum(pending, approved, rejected) | no |  |
| data[].uploaded_by | string | no |  |
| data[].upload_date | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 401
未授权
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## upload_document
- Handler: uploadDocument
- Description: 上传技术文档

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | yes | 文档标题 |
| doc_type | string | no | 文档类型 |
| category | string | no | 分类 |
| description | string | no | 文档描述 |
| file_url | string | no | 文件URL |
| asset_code | string | no | 关联资产编号 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /technical-documents | fuzzy | POST /api/technical-documents | 上传技术资料 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/technical-documents
- Summary: 上传技术资料
- Description: 上传技术资料文件，支持单个资产关联或多个资产关联。新上传的资料默认状态为 pending（待审核）
- Tags: 技术资料管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### multipart/form-data
### Schema (multipart/form-data)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| file | string | yes | 技术资料文件 |
| title | string | yes | 资料标题（必填） |
| description | string | no | 资料描述 |
| category | enum(使用手册, 维修手册, 技术规范, 操作指南, 其他) | no | 资料分类 |
| asset_type | string | no | 资产类型 |
| brand | string | no | 品牌 |
| model | string | no | 型号 |
| version | string | no | 版本号 |
| language | string | no | 语言 |
| asset_code | string | no | 单个资产编码（关联单个资产） |
| asset_codes | array&lt;string&gt; | no | 多个资产编码数组（关联多个资产） |
| asset_codes[] | string | no |  |
| is_public | boolean | no | 是否公开 |

### Responses
#### 200
上传成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | object | no |  |
| data.id | integer | no |  |
| data.title | string | no |  |
| data.file_name | string | no |  |
| data.file_path | string | no |  |
| data.file_url | string | no |  |

#### 400
请求参数错误（如文件为空、标题为空等）
##### application/json
### Response Schema (400 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

#### 401
未授权
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## review_document
- Handler: reviewDocument
- Description: 审核文档

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| review_status | string | no | 审核状态：approved/rejected |
| action | string | no | 兼容旧参数：approve/reject |
| comment | string | no | 审核意见 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /technical-documents/{id}/review | fuzzy | POST /api/technical-documents/{id}/review | 创建/提交 /api/technical-documents/{id}/review |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/technical-documents/{id}/review
- Summary: 创建/提交 /api/technical-documents/{id}/review
- Description: 自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: technical-documents

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_document_tags
- Handler: listDocumentTags
- Description: 获取技术文档标签列表

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_document_tag
- Handler: createDocumentTag
- Description: 创建技术文档标签

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tag_name | string | yes | 标签名称 |
| tag_color | string | no | 标签颜色 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_document_tag
- Handler: deleteDocumentTag
- Description: 删除技术文档标签

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 标签ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_document_tags
- Handler: updateDocumentTags
- Description: 更新文档关联标签

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| items | integer | no |  |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_document_versions
- Handler: listDocumentVersions
- Description: 获取文档版本列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_document_version
- Handler: createDocumentVersion
- Description: 创建文档版本记录

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| version_number | string | yes | 版本号 |
| change_log | string | no | 变更日志 |
| file_path | string | no | 文件路径 |
| file_size | integer | no | 文件大小 |
| file_hash | string | no | 文件哈希 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## favorite_document
- Handler: favoriteDocument
- Description: 收藏技术文档

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## unfavorite_document
- Handler: unfavoriteDocument
- Description: 取消收藏技术文档

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_favorite_documents
- Handler: listFavoriteDocuments
- Description: 获取当前用户收藏的技术文档列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_document_comments
- Handler: listDocumentComments
- Description: 获取文档评论列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| resolved | boolean | no | 是否仅查看已解决评论 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_document_comment
- Handler: createDocumentComment
- Description: 创建文档评论

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| content | string | yes | 评论内容 |
| parent_id | integer | no | 父评论ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## resolve_document_comment
- Handler: resolveDocumentComment
- Description: 将文档评论标记为已解决

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 评论ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_document_templates
- Handler: listDocumentTemplates
- Description: 获取技术文档模板列表

### MCP Input Schema
无
### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_document_template
- Handler: createDocumentTemplate
- Description: 创建技术文档模板

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| template_name | string | yes | 模板名称 |
| template_description | string | no | 模板描述 |
| category_id | integer | no | 分类ID |
| template_fields | object | no | 模板字段配置 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_document_template
- Handler: deleteDocumentTemplate
- Description: 删除技术文档模板

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 模板ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## batch_delete_documents
- Handler: batchDeleteDocuments
- Description: 批量删除技术文档

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | integer | no |  |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## batch_update_document_category
- Handler: batchUpdateDocumentCategory
- Description: 批量更新技术文档分类

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | integer | no |  |
| category_id | integer | yes | 目标分类ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## create_document_share
- Handler: createDocumentShare
- Description: 为技术文档创建外部上传分享链接

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |
| expires_days | integer | no | 有效天数 |
| max_uploads | integer | no | 最大上传次数 |
| remark | string | no | 备注 |
| supplier_name | string | no | 供应商名称 |
| supplier_contact | string | no | 供应商联系方式 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_document_shares
- Handler: listDocumentShares
- Description: 获取文档分享链接列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 文档ID |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## delete_document_share
- Handler: deleteDocumentShare
- Description: 删除文档分享链接

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| share_id | integer | yes | 分享链接ID |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## list_asset_labels
- Handler: listAssetLabels

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /asset-labels | fuzzy | GET /api/asset-labels/templates | 获取标签模板列表 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/asset-labels/templates
- Summary: 获取标签模板列表
- Description: 获取当前租户的标签模板列表
- Tags: 资产标签

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功获取标签模板列表
## create_asset_label
- Handler: createAssetLabel
- Description: 创建资产标签

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes | 标签名称 |
| color | string | no | 颜色 |
| description | string | no | 描述 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /asset-labels | fuzzy | POST /api/asset-labels/templates | 创建标签模板 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/asset-labels/templates
- Summary: 创建标签模板
- Description: 创建新的标签模板
- Tags: 资产标签

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes | 模板名称 |
| description | string | no | 模板描述 |
| width | number | yes | 标签宽度（英寸） |
| height | number | yes | 标签高度（英寸） |
| dpi | number | no | 打印机DPI |
| fields | array&lt;unknown&gt; | yes | 标签字段列表 |

### Responses
#### 200
成功创建标签模板
## assign_asset_label
- Handler: assignAssetLabel

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| POST /asset-labels/assign | fuzzy | POST /api/asset-labels/templates | 创建标签模板 |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: POST /api/asset-labels/templates
- Summary: 创建标签模板
- Description: 创建新的标签模板
- Tags: 资产标签

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes | 模板名称 |
| description | string | no | 模板描述 |
| width | number | yes | 标签宽度（英寸） |
| height | number | yes | 标签高度（英寸） |
| dpi | number | no | 打印机DPI |
| fields | array&lt;unknown&gt; | yes | 标签字段列表 |

### Responses
#### 200
成功创建标签模板
## get_ai_maintenance_prediction
- Handler: getAIMaintenancePrediction
- Description: 获取AI维修预测

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |
| days_ahead | integer | no | 预测天数 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_ai_failure_analysis
- Handler: getAIFailureAnalysis
- Description: 获取AI故障分析

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_asset_risk_assessment
- Handler: getAssetRiskAssessment
- Description: 获取资产风险评估列表，可按资产编号、部门、风险等级筛选

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |
| department | string | no | 部门 |
| keyword | string | no | 关键词，匹配资产编号或资产名称 |
| risk_level | string | no | 风险等级 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_high_risk_assets
- Handler: getHighRiskAssets
- Description: 获取高风险资产列表；未指定 risk_level 时默认返回 high 和 critical

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| risk_level | string | no | 风险等级 |
| department | string | no | 部门 |
| keyword | string | no | 关键词，匹配资产编号或资产名称 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_risk_dashboard
- Handler: getRiskDashboard
- Description: 获取风险管理仪表盘统计

### MCP Input Schema
无
### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| GET /risk/dashboard | fuzzy | GET /api/risk/dashboard | 查询 /api/risk/dashboard |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: GET /api/risk/dashboard
- Summary: 查询 /api/risk/dashboard
- Description: 自动从 modules/asset-risk-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: risk

### Authentication
无
### Path Parameters
无
### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## list_risk_controls
- Handler: listRiskControls
- Description: 获取风险控制措施列表

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| status | string | no | 状态筛选 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## update_risk_control
- Handler: updateRiskControl
- Description: 更新风险控制措施

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 风险控制ID |
| assessment_id | integer | no | 关联风险评估ID |
| control_code | string | no | 控制编号 |
| control_name | string | no | 控制名称 |
| control_type | string | no | 控制类型 |
| risk_level | string | no | 风险等级 |
| control_description | string | no | 控制说明 |
| planned_end_date | string | no | 计划完成日期 (YYYY-MM-DD) |
| actual_end_date | string | no | 实际完成日期 (YYYY-MM-DD) |
| responsible_person | string | no | 责任人 |
| status | string | no | 状态 |
| progress | integer | no | 进度百分比 |
| remarks | string | no | 备注 |

### MCP Backend Requests
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| PUT /risk/controls/{id} | fuzzy | PUT /api/risk/controls/{id} | 更新 /api/risk/controls/{id} |

### Matched Backend Endpoint
- Match: fuzzy
- Endpoint: PUT /api/risk/controls/{id}
- Summary: 更新 /api/risk/controls/{id}
- Description: 自动从 modules/asset-risk-management/routes/risk-control.routes.js 的 Express 路由声明生成的基础接口文档。
- Tags: 自动发现: risk

### Authentication
无
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |

### Query Parameters
无
### Header Parameters
无
### Cookie Parameters
无
### Request Body
#### application/json
### Schema (application/json)
无
### Responses
#### 200
请求成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| data | object | no |  |
| message | string | no |  |

#### 401
未认证或令牌无效
#### 500
服务器内部错误
## get_predictive_maintenance
- Handler: getPredictiveMaintenance
- Description: 获取预测性维护计划

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| department | string | no | 部门 |
| category_id | integer | no | 资产类别ID |
| days_ahead | integer | no | 计划天数 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_asset_health_index
- Handler: getAssetHealthIndex
- Description: 获取资产健康指数

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
## get_department_health_overview
- Handler: getDepartmentHealthOverview
- Description: 获取部门健康概览

### MCP Input Schema
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| department | string | no | 部门 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| doc_type | string | no | 文档类型 |
| category | string | no | 分类 |
| status | string | no | 状态 |

### MCP Backend Requests
未识别到 client.doRequest 调用
### Matched Backend Endpoint
未识别到 MCP 请求实现，请检查 tool_handlers.go。
