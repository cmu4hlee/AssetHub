# AssetHub API Documentation
> Generated at: 2026-05-01T06:58:48.638Z
> OpenAPI version: 3.0.0
> Total endpoints: 659
> Servers: http://:::5183, https://api.example.com

## DELETE /api/acceptance/files/{id}
> 删除 /api/acceptance/files/{id}
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## GET /api/acceptance/files/{id}/download
> 查询 /api/acceptance/files/{id}/download
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## GET /api/acceptance/records
> 查询 /api/acceptance/records
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

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
## POST /api/acceptance/records
> 创建/提交 /api/acceptance/records
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

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
## DELETE /api/acceptance/records/{id}
> 删除 /api/acceptance/records/{id}
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## GET /api/acceptance/records/{id}
> 查询 /api/acceptance/records/{id}
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## PUT /api/acceptance/records/{id}
> 更新 /api/acceptance/records/{id}
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## GET /api/acceptance/records/{id}/files
> 查询 /api/acceptance/records/{id}/files
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## POST /api/acceptance/records/{id}/files
> 创建/提交 /api/acceptance/records/{id}/files
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## PUT /api/acceptance/records/{id}/status
> 更新 /api/acceptance/records/{id}/status
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

### Authentication
bearerAuth
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
## GET /api/acceptance/statistics
> 查询 /api/acceptance/statistics
自动从 routes/acceptance.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: acceptance

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
## GET /api/adverse-events
> 查询 /api/adverse-events
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

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
## POST /api/adverse-events
> 创建/提交 /api/adverse-events
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

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
## DELETE /api/adverse-events/{id}
> 删除 /api/adverse-events/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## GET /api/adverse-events/{id}
> 查询 /api/adverse-events/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## PUT /api/adverse-events/{id}
> 更新 /api/adverse-events/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## POST /api/adverse-events/{id}/approve
> 创建/提交 /api/adverse-events/{id}/approve
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## POST /api/adverse-events/{id}/attachments
> 创建/提交 /api/adverse-events/{id}/attachments
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## POST /api/adverse-events/{id}/close
> 创建/提交 /api/adverse-events/{id}/close
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## GET /api/adverse-events/{id}/workflow
> 查询 /api/adverse-events/{id}/workflow
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## GET /api/adverse-events/alerts/overdue
> 查询 /api/adverse-events/alerts/overdue
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

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
## DELETE /api/adverse-events/attachments/{id}
> 删除 /api/adverse-events/attachments/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

### Authentication
bearerAuth
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
## GET /api/adverse-events/statistics/overview
> 查询 /api/adverse-events/statistics/overview
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-events

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
## GET /api/adverse-reaction
> 查询 /api/adverse-reaction
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

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
## POST /api/adverse-reaction
> 创建/提交 /api/adverse-reaction
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

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
## DELETE /api/adverse-reaction/{id}
> 删除 /api/adverse-reaction/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## GET /api/adverse-reaction/{id}
> 查询 /api/adverse-reaction/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## PUT /api/adverse-reaction/{id}
> 更新 /api/adverse-reaction/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## POST /api/adverse-reaction/{id}/approve
> 创建/提交 /api/adverse-reaction/{id}/approve
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## POST /api/adverse-reaction/{id}/attachments
> 创建/提交 /api/adverse-reaction/{id}/attachments
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## POST /api/adverse-reaction/{id}/close
> 创建/提交 /api/adverse-reaction/{id}/close
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## GET /api/adverse-reaction/{id}/workflow
> 查询 /api/adverse-reaction/{id}/workflow
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## GET /api/adverse-reaction/alerts/overdue
> 查询 /api/adverse-reaction/alerts/overdue
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

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
## DELETE /api/adverse-reaction/attachments/{id}
> 删除 /api/adverse-reaction/attachments/{id}
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

### Authentication
bearerAuth
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
## GET /api/adverse-reaction/statistics/overview
> 查询 /api/adverse-reaction/statistics/overview
自动从 routes/adverse-reaction.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: adverse-reaction

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
## POST /api/agent-mesh/init
> 创建/提交 /api/agent-mesh/init
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## POST /api/agent-mesh/intelligence/health-index
> 创建/提交 /api/agent-mesh/intelligence/health-index
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/agent-mesh/intelligence/health-trend
> 查询 /api/agent-mesh/intelligence/health-trend
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## POST /api/agent-mesh/intelligence/predictive-maintenance
> 创建/提交 /api/agent-mesh/intelligence/predictive-maintenance
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## POST /api/agent-mesh/intelligence/risk-score
> 创建/提交 /api/agent-mesh/intelligence/risk-score
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/agent-mesh/intelligence/risk-trend
> 查询 /api/agent-mesh/intelligence/risk-trend
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## POST /api/agent-mesh/message
> 创建/提交 /api/agent-mesh/message
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/agent-mesh/microservice/events
> 查询 /api/agent-mesh/microservice/events
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/agent-mesh/microservice/roadmap
> 查询 /api/agent-mesh/microservice/roadmap
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/agent-mesh/topology
> 查询 /api/agent-mesh/topology
自动从 routes/agent-mesh.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: agent-mesh

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
## GET /api/ai-assistant/config
> 查询 /api/ai-assistant/config
自动从 routes/ai-assistant.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai-assistant

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
## POST /api/ai-assistant/history
> 创建/提交 /api/ai-assistant/history
自动从 routes/ai-assistant.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai-assistant

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
## GET /api/ai-assistant/modes
> 查询 /api/ai-assistant/modes
自动从 routes/ai-assistant.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai-assistant

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
## POST /api/ai-assistant/query
> 创建/提交 /api/ai-assistant/query
自动从 routes/ai-assistant.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai-assistant

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
## GET /api/ai-assistant/quick-questions
> 查询 /api/ai-assistant/quick-questions
自动从 routes/ai-assistant.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai-assistant

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
## POST /api/ai/chat/completions
> AI对话补全
通过AI网关或OpenCode进行对话补全
**Tags:** AI服务

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
| messages | array&lt;unknown&gt; | yes | 消息列表 |
| model | string | no | 模型名称 |
| stream | boolean | no | 是否流式响应 |
| temperature | number | no |  |
| max_tokens | integer | no |  |
| session_id | string | no |  |
| client_request_id | string | no |  |

### Responses
#### 200
成功
#### 400
请求错误
#### 500
服务器错误
#### 502
AI服务错误
#### 503
服务不可用
## POST /api/ai/completions
> 创建/提交 /api/ai/completions
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ai

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
## GET /api/ai/config
> 获取AI配置信息
**Tags:** AI服务

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
| data.defaultModel | string | no |  |
| data.defaultProvider | string | no |  |
| data.providers | object | no |  |

## GET /api/alive
> 查询 /api/alive
自动从 routes/health.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: alive

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
## GET /api/analysis
> 获取资产综合分析数据
获取资产分类、部门、状态、价值、年龄等综合分析
**Tags:** 资产分析

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
| data.by_category | array&lt;unknown&gt; | no |  |
| data.by_department | array&lt;unknown&gt; | no |  |
| data.by_status | array&lt;unknown&gt; | no |  |
| data.value_summary | object | no |  |
| data.age_distribution | object | no |  |
| data.monthly_trend | array&lt;unknown&gt; | no |  |

#### 500
服务器错误
## GET /api/analysis/depreciation
> 获取资产折旧分析
**Tags:** 资产分析

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
| data | array&lt;object&gt; | no |  |
| data[].depreciation_method | string | no |  |
| data[].count | integer | no |  |
| data[].total_original_value | number | no |  |
| data[].total_current_value | number | no |  |
| data[].total_depreciated | number | no |  |
| data[].avg_years | number | no |  |

#### 500
服务器错误
## GET /api/analysis/value-distribution
> 获取资产价值分布分析
**Tags:** 资产分析

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
| data | array&lt;object&gt; | no |  |
| data[].value_range | string | no |  |
| data[].count | integer | no |  |

#### 500
服务器错误
## GET /api/api-documentation
> 查询 /api/api-documentation
自动从 routes/api-documentation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: api-documentation

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
## GET /api/api-documentation/endpoints
> 查询 /api/api-documentation/endpoints
自动从 routes/api-documentation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: api-documentation

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
## GET /api/api-documentation/module/{path}
> 查询 /api/api-documentation/module/{path}
自动从 routes/api-documentation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: api-documentation

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | yes |  |

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
## GET /api/api-documentation/modules
> 查询 /api/api-documentation/modules
自动从 routes/api-documentation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: api-documentation

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
## GET /api/asset-ai-analysis/analysis-history
> 查询 /api/asset-ai-analysis/analysis-history
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## POST /api/asset-ai-analysis/analyze-asset/{assetCode}
> 创建/提交 /api/asset-ai-analysis/analyze-asset/{assetCode}
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

### Authentication
bearerAuth
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
## POST /api/asset-ai-analysis/analyze-assets
> 创建/提交 /api/asset-ai-analysis/analyze-assets
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## POST /api/asset-ai-analysis/custom-analysis
> 创建/提交 /api/asset-ai-analysis/custom-analysis
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## GET /api/asset-ai-analysis/datasources
> 查询 /api/asset-ai-analysis/datasources
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## GET /api/asset-ai-analysis/dimensions
> 查询 /api/asset-ai-analysis/dimensions
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## GET /api/asset-ai-analysis/question-records
> 查询 /api/asset-ai-analysis/question-records
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

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
## GET /api/asset-ai-analysis/reports/{id}
> 查询 /api/asset-ai-analysis/reports/{id}
自动从 routes/asset-ai-analysis.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-ai-analysis

### Authentication
bearerAuth
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
## GET /api/asset-images
> 查询 /api/asset-images
自动从 routes/asset-images.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-images

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
## POST /api/asset-labels/generate-zpl-batch
> 批量生成ZPL标签
为多个资产批量生成ZPL格式标签
**Tags:** 资产标签

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
| asset_codes | array&lt;unknown&gt; | yes | 资产编码列表 |
| template_id | integer | yes | 模板ID |
| quantity_per_asset | integer | no | 每个资产打印数量 |

### Responses
#### 200
成功批量生成ZPL标签
## GET /api/asset-labels/generate-zpl/:templateId/:assetCode
> 生成ZPL标签
根据资产信息和模板生成ZPL格式标签
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| templateId | integer | yes |  |
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
成功生成ZPL标签
## GET /api/asset-labels/generate-zpl/{templateId}/{assetCode}
> 查询 /api/asset-labels/generate-zpl/{templateId}/{assetCode}
自动从 routes/asset-labels.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-labels

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| templateId | string | yes |  |
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
## POST /api/asset-labels/print
> 打印标签
直接打印资产标签
**Tags:** 资产标签

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
| asset_id | integer | yes | 资产ID |
| template_id | integer | yes | 模板ID |
| printer_ip | string | yes | 打印机IP地址 |
| printer_port | integer | no | 打印机端口 |
| quantity | integer | yes | 打印数量 |

### Responses
#### 200
成功发送打印任务
## GET /api/asset-labels/print-queue
> 获取打印队列
获取打印任务队列
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | enum(pending, printing, completed, failed) | no | 任务状态 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功获取打印队列
## PUT /api/asset-labels/print-queue/{id}/status
> 更新打印任务状态
更新指定ID的打印任务状态
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 任务ID |

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
| status | enum(pending, printing, completed, failed) | yes |  |
| error_message | string | no | 错误信息 |

### Responses
#### 200
成功更新打印任务状态
## POST /api/asset-labels/printer/test-connection
> 创建/提交 /api/asset-labels/printer/test-connection
自动从 routes/asset-labels.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-labels

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
## GET /api/asset-labels/templates
> 获取标签模板列表
获取当前租户的标签模板列表
**Tags:** 资产标签

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
## POST /api/asset-labels/templates
> 创建标签模板
创建新的标签模板
**Tags:** 资产标签

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
## DELETE /api/asset-labels/templates/{id}
> 删除标签模板
删除指定ID的标签模板
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 模板ID |

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
成功删除标签模板
## GET /api/asset-labels/templates/{id}
> 获取标签模板详情
获取指定ID的标签模板详情
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 模板ID |

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
成功获取标签模板详情
## PUT /api/asset-labels/templates/{id}
> 更新标签模板
更新指定ID的标签模板
**Tags:** 资产标签

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 模板ID |

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
| name | string | no | 模板名称 |
| description | string | no | 模板描述 |
| width | number | no | 标签宽度（英寸） |
| height | number | no | 标签高度（英寸） |
| dpi | number | no | 打印机DPI |
| fields | array&lt;unknown&gt; | no | 标签字段列表 |

### Responses
#### 200
成功更新标签模板
## POST /api/asset-location/assets/{assetIdOrCode}/bind-device
> 创建/提交 /api/asset-location/assets/{assetIdOrCode}/bind-device
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## GET /api/asset-location/assets/{assetIdOrCode}/devices
> 查询 /api/asset-location/assets/{assetIdOrCode}/devices
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## GET /api/asset-location/assets/{assetIdOrCode}/location
> 查询 /api/asset-location/assets/{assetIdOrCode}/location
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## POST /api/asset-location/assets/{assetIdOrCode}/location
> 创建/提交 /api/asset-location/assets/{assetIdOrCode}/location
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## GET /api/asset-location/assets/{assetIdOrCode}/location/history
> 查询 /api/asset-location/assets/{assetIdOrCode}/location/history
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## POST /api/asset-location/assets/{assetIdOrCode}/unbind-device
> 创建/提交 /api/asset-location/assets/{assetIdOrCode}/unbind-device
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## POST /api/asset-location/assets/in-area
> 创建/提交 /api/asset-location/assets/in-area
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## POST /api/asset-location/assets/locations
> 创建/提交 /api/asset-location/assets/locations
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## GET /api/asset-location/beacon-assets
> 查询 /api/asset-location/beacon-assets
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## POST /api/asset-location/beacon-location
> 创建/提交 /api/asset-location/beacon-location
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## GET /api/asset-location/devices
> 查询 /api/asset-location/devices
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## POST /api/asset-location/devices
> 创建/提交 /api/asset-location/devices
自动从 routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: asset-location

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
## GET /api/assets
> 获取资产列表
**Tags:** Assets

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no |  |
| pageSize | integer | no |  |
| search | string | no |  |
| status | string | no |  |
| department_id | integer | no |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功获取资产列表
## POST /api/assets
> 创建资产
**Tags:** Assets

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
无
### Responses
#### 201
资产创建成功
## GET /api/assets/{assetId}/images
> 查询 /api/assets/{assetId}/images
自动从 routes/asset-images.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetId | string | yes |  |

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
## POST /api/assets/{assetId}/images
> 创建/提交 /api/assets/{assetId}/images
自动从 routes/asset-images.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetId | string | yes |  |

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
## DELETE /api/assets/{id}
> 删除资产
**Tags:** Assets

### Authentication
bearerAuth
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
无
## GET /api/assets/{id}
> 获取资产详情
**Tags:** Assets

### Authentication
bearerAuth
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
成功获取资产详情
## PUT /api/assets/{id}
> 更新资产
**Tags:** Assets

### Authentication
bearerAuth
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
无
### Responses
无
## GET /api/assets/{id}/change-logs
> 获取资产变更日志
**Tags:** Assets

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
无
## POST /api/assets/{id}/share
> 创建/提交 /api/assets/{id}/share
自动从 routes/assets/asset.share.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## GET /api/assets/{id}/shares
> 查询 /api/assets/{id}/shares
自动从 routes/assets/asset.share.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## POST /api/assets/{id}/transfer-apply
> 创建/提交 /api/assets/{id}/transfer-apply
自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## GET /api/assets/{id}/transitions
> 获取资产可执行的状态迁移
**Tags:** Assets

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
无
## GET /api/assets/all
> 全量查询资产列表（不分页）
返回所有符合条件的资产数据，用于数据导出等场景
**Tags:** Assets

### Authentication
bearerAuth
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

## GET /api/assets/categories
> 查询 /api/assets/categories
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## POST /api/assets/categories
> 创建/提交 /api/assets/categories
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## DELETE /api/assets/categories/{id}
> 删除 /api/assets/categories/{id}
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## PUT /api/assets/categories/{id}
> 更新 /api/assets/categories/{id}
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## GET /api/assets/categories/list
> 查询 /api/assets/categories/list
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/categories/tree
> 查询 /api/assets/categories/tree
自动从 routes/assets/asset.category.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/departments/list
> 获取部门列表（用于资产筛选）
**Tags:** Assets

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
无
## GET /api/assets/duplicate-check
> 检查资产编码是否重复
**Tags:** Assets

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes |  |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
检查结果
## GET /api/assets/export
> 查询 /api/assets/export
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/export/template
> 查询 /api/assets/export/template
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## DELETE /api/assets/images/{imageId}
> 删除 /api/assets/images/{imageId}
自动从 routes/asset-images.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| imageId | string | yes |  |

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
## PUT /api/assets/images/{imageId}
> 更新 /api/assets/images/{imageId}
自动从 routes/asset-images.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| imageId | string | yes |  |

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
## POST /api/assets/import
> 创建/提交 /api/assets/import
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/import-template
> 查询 /api/assets/import-template
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## POST /api/assets/import/validate
> 创建/提交 /api/assets/import/validate
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## POST /api/assets/legacy/import
> 创建/提交 /api/assets/legacy/import
自动从 routes/assets/asset.import-export.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/share/{token}
> 查询 /api/assets/share/{token}
自动从 routes/assets/asset.share.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | yes |  |

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
## DELETE /api/assets/shares/{share_id}
> 删除 /api/assets/shares/{share_id}
自动从 routes/assets/asset.share.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| share_id | string | yes |  |

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
## GET /api/assets/statistics/by-department
> 查询 /api/assets/statistics/by-department
自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/statistics/depreciation
> 查询 /api/assets/statistics/depreciation
自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/statistics/expiring-warranties
> 查询 /api/assets/statistics/expiring-warranties
自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/statistics/overview
> 查询 /api/assets/statistics/overview
自动从 routes/assets/asset.statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## GET /api/assets/transfer-requests
> 查询 /api/assets/transfer-requests
自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

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
## POST /api/assets/transfer-requests/{request_id}/approve
> 创建/提交 /api/assets/transfer-requests/{request_id}/approve
自动从 routes/assets/asset.transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: assets

### Authentication
bearerAuth
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
## GET /api/audit-logs
> 获取操作日志列表
获取操作日志列表，支持分页、筛选和搜索。只有系统管理员可以查看所有日志，其他角色只能查看自己的操作日志。
**Tags:** 操作日志（审计）

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

## GET /api/audit-logs/{id}
> 获取操作日志详情
获取单条操作日志的详细信息，包括请求参数、修改前后的值等
**Tags:** 操作日志（审计）

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 日志ID |

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
获取成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | object | no |  |
| data.id | integer | no |  |
| data.user_id | integer | no |  |
| data.username | string | no |  |
| data.real_name | string | no |  |
| data.role | string | no |  |
| data.action_type | string | no |  |
| data.module | string | no |  |
| data.resource_type | string | no |  |
| data.resource_id | integer | no |  |
| data.resource_name | string | no |  |
| data.action_description | string | no |  |
| data.old_value | object | no | 修改前的值（JSON对象） |
| data.new_value | object | no | 修改后的值（JSON对象） |
| data.ip_address | string | no |  |
| data.user_agent | string | no |  |
| data.request_method | string | no |  |
| data.request_path | string | no |  |
| data.request_params | object | no | 请求参数（JSON对象） |
| data.response_status | integer | no |  |
| data.error_message | string | no |  |
| data.execution_time | integer | no |  |
| data.created_at | string | no |  |

#### 404
日志不存在
##### application/json
### Response Schema (404 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## GET /api/audit-logs/stats
> 获取操作日志统计
获取操作日志的统计信息，包括操作类型分布、模块分布、用户操作统计等
**Tags:** 操作日志（审计）

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| start_date | string | no | 开始日期（YYYY-MM-DD） |
| end_date | string | no | 结束日期（YYYY-MM-DD） |

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
| data | object | no |  |
| data.action_type_stats | array&lt;unknown&gt; | no | 操作类型统计 |
| data.module_stats | array&lt;unknown&gt; | no | 模块统计 |
| data.user_stats | array&lt;unknown&gt; | no | 用户操作统计 |
| data.daily_stats | array&lt;unknown&gt; | no | 每日操作统计 |

## GET /api/backup
> 获取备份列表
获取所有数据库备份文件列表
**Tags:** 数据库备份

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
获取成功
## POST /api/backup
> 创建数据库备份
创建数据库备份文件，只有系统管理员可以执行此操作
**Tags:** 数据库备份

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
| description | string | no | 备份描述（可选） |

### Responses
#### 200
备份成功
#### 403
权限不足
#### 500
备份失败
## DELETE /api/backup/{id}
> 删除备份文件
删除指定的备份文件和记录，只有系统管理员可以执行此操作
**Tags:** 数据库备份

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 备份ID |

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
#### 403
权限不足
#### 404
备份不存在
## GET /api/backup/{id}/download
> 下载备份文件
下载指定的备份文件
**Tags:** 数据库备份

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 备份ID |

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
下载成功
#### 404
备份文件不存在
## POST /api/backup/{id}/restore
> 恢复数据库备份
从备份文件恢复数据库，只有系统管理员可以执行此操作。此操作会覆盖现有数据，请谨慎操作。
**Tags:** 数据库备份

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 备份ID |

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
| confirm | boolean | yes | 确认恢复（必须为 true） |

### Responses
#### 200
恢复成功
#### 400
请求参数无效
#### 403
权限不足
#### 404
备份文件不存在
#### 500
恢复失败
## POST /api/backup/add-tenant-id
> 为表添加tenant_id字段
为指定的表添加tenant_id字段和索引，支持多租户隔离
**Tags:** 数据库备份

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
添加成功
#### 403
权限不足
#### 500
添加失败
## GET /api/barcode-scan
> 条码扫描API信息
**Tags:** 条码扫描

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
API信息
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| endpoints | object | no |  |
| endpoints.generate | string | no |  |
| endpoints.logs | string | no |  |

## GET /api/barcode-scan/generate/{asset_code}
> 生成资产二维码
根据资产编号生成包含资产信息的二维码图片
**Tags:** 条码扫描

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | yes | 资产编号 |

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
二维码图片
##### image/png
### Response Schema (200 image/png)
无
#### 404
资产不存在
##### application/json
### Response Schema (404 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |

#### 500
服务器错误
##### application/json
### Response Schema (500 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## POST /api/barcode-scan/inventory
> 扫码进行盘点
通过扫描资产二维码进行资产盘点
**Tags:** 条码扫描

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
| qr_data | string | yes | 二维码数据 |
| inventory_id | integer | yes | 盘点记录ID |
| actual_location | string | no | 实际位置 |
| actual_status | string | no | 实际状态 |

### Responses
#### 200
盘点成功
#### 400
参数错误
#### 404
资产或盘点记录不存在
#### 500
服务器错误
## GET /api/barcode-scan/logs
> 获取扫码日志
查询资产扫码日志记录
**Tags:** 条码扫描

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| asset_code | string | no | 资产编号 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |
| scan_type | enum(verify, inventory) | no | 扫码类型 |
| page | integer | no | 页码 |
| limit | integer | no | 每页数量 |

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
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].asset_code | string | no |  |
| data[].scan_type | string | no |  |
| data[].scan_by | string | no |  |
| data[].scan_time | string | no |  |
| data[].asset_name | string | no |  |
| pagination | object | no |  |
| pagination.total | integer | no |  |
| pagination.page | integer | no |  |
| pagination.limit | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 500
服务器错误
## POST /api/barcode-scan/verify
> 扫码验证资产
通过扫描资产二维码验证资产信息
**Tags:** 条码扫描

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
| qr_data | string | yes | 二维码数据(JSON字符串) |

### Responses
#### 200
验证成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | object | no |  |

#### 400
参数错误
#### 404
资产不存在
#### 500
服务器错误
## POST /api/chat/chat/completions
> 创建/提交 /api/chat/chat/completions
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## POST /api/chat/completions
> 创建/提交 /api/chat/completions
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## GET /api/chat/config
> 查询 /api/chat/config
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## GET /api/circuit-breakers
> 查询 /api/circuit-breakers
自动从 routes/health.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: circuit-breakers

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
## POST /api/circuit-breakers/{name}/reset
> 创建/提交 /api/circuit-breakers/{name}/reset
自动从 routes/health.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: circuit-breakers

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes |  |

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
## GET /api/cloud-sync/events
> 获取同步事件列表
**Tags:** 云同步

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| source_id | integer | no | 同步源ID |

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
## GET /api/cloud-sync/events/stream
> 订阅同步事件流
SSE流式获取实时同步事件
**Tags:** 云同步

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| since_id | integer | no | 从指定ID之后开始 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
## GET /api/cloud-sync/sources
> 获取同步源列表
**Tags:** 云同步

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
## POST /api/cloud-sync/sources
> 创建同步源
**Tags:** 云同步

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
| name | string | yes | 同步源名称 |
| source_type | string | yes | 同步源类型 |
| status | enum(active, inactive) | no |  |
| secret_token | string | no | 密钥令牌 |
| config_json | object | no | 配置JSON |

### Responses
#### 200
创建成功
#### 400
参数错误
#### 500
服务器错误
## DELETE /api/cloud-sync/sources/{id}
> 删除同步源
**Tags:** 云同步

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 同步源ID |

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
#### 500
服务器错误
## PUT /api/cloud-sync/sources/{id}
> 更新同步源
**Tags:** 云同步

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 同步源ID |

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
| name | string | no |  |
| source_type | string | no |  |
| status | string | no |  |
| secret_token | string | no |  |
| config_json | object | no |  |

### Responses
#### 200
更新成功
#### 404
同步源不存在
#### 500
服务器错误
## POST /api/cloud-sync/webhook/{sourceId}
> 接收云同步Webhook事件
接收来自外部系统的资产/设备同步事件
**Tags:** 云同步

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| sourceId | integer | yes | 同步源ID |

### Query Parameters
无
### Header Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| X-Webhook-Token | string | no | Webhook认证令牌 |

### Cookie Parameters
无
### Request Body
必填请求体: yes
#### application/json
### Schema (application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| event_type | string | no | 事件类型 |
| payload | object | no | 事件数据 |
| asset | object | no | 资产数据 |
| device | object | no | 设备数据 |

### Responses
#### 200
处理成功
#### 401
Token无效
#### 404
同步源不存在
#### 500
服务器错误
## GET /api/compliance
> 查询 /api/compliance
自动从 modules/compliance-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/dashboard-stats
> 查询 /api/compliance/dashboard-stats
自动从 modules/compliance-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/maintenance-level/dashboard-stats
> 查询 /api/compliance/maintenance-level/dashboard-stats
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/maintenance-level/plans
> 查询 /api/compliance/maintenance-level/plans
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/maintenance-level/plans/generate
> 创建/提交 /api/compliance/maintenance-level/plans/generate
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/maintenance-level/templates
> 查询 /api/compliance/maintenance-level/templates
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/maintenance-level/templates
> 创建/提交 /api/compliance/maintenance-level/templates
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## DELETE /api/compliance/maintenance-level/templates/{id}
> 删除 /api/compliance/maintenance-level/templates/{id}
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## GET /api/compliance/maintenance-level/templates/{id}
> 查询 /api/compliance/maintenance-level/templates/{id}
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## PUT /api/compliance/maintenance-level/templates/{id}
> 更新 /api/compliance/maintenance-level/templates/{id}
自动从 modules/compliance-management/routes/maintenance-level.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## GET /api/compliance/safety-inspection
> 查询 /api/compliance/safety-inspection
自动从 modules/compliance-management/routes/safety-inspection.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/safety-inspection
> 创建/提交 /api/compliance/safety-inspection
自动从 modules/compliance-management/routes/safety-inspection.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## DELETE /api/compliance/safety-inspection/{id}
> 删除 /api/compliance/safety-inspection/{id}
自动从 modules/compliance-management/routes/safety-inspection.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## PUT /api/compliance/safety-inspection/{id}
> 更新 /api/compliance/safety-inspection/{id}
自动从 modules/compliance-management/routes/safety-inspection.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## GET /api/compliance/special-equipment
> 查询 /api/compliance/special-equipment
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/special-equipment
> 创建/提交 /api/compliance/special-equipment
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## DELETE /api/compliance/special-equipment/{id}
> 删除 /api/compliance/special-equipment/{id}
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## PUT /api/compliance/special-equipment/{id}
> 更新 /api/compliance/special-equipment/{id}
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## GET /api/compliance/special-equipment/expiring-inspections
> 查询 /api/compliance/special-equipment/expiring-inspections
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/special-equipment/inspections
> 查询 /api/compliance/special-equipment/inspections
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/special-equipment/inspections
> 创建/提交 /api/compliance/special-equipment/inspections
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## DELETE /api/compliance/special-equipment/inspections/{id}
> 删除 /api/compliance/special-equipment/inspections/{id}
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## PUT /api/compliance/special-equipment/inspections/{id}
> 更新 /api/compliance/special-equipment/inspections/{id}
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

### Authentication
bearerAuth
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
## GET /api/compliance/special-equipment/statistics/overview
> 查询 /api/compliance/special-equipment/statistics/overview
自动从 modules/compliance-management/routes/special-equipment.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/staff-qualification/qualifications
> 查询 /api/compliance/staff-qualification/qualifications
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/staff-qualification/qualifications
> 创建/提交 /api/compliance/staff-qualification/qualifications
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/staff-qualification/qualifications/expiring
> 查询 /api/compliance/staff-qualification/qualifications/expiring
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/staff-qualification/statistics
> 查询 /api/compliance/staff-qualification/statistics
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/staff-qualification/training-records
> 查询 /api/compliance/staff-qualification/training-records
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/staff-qualification/training-records
> 创建/提交 /api/compliance/staff-qualification/training-records
自动从 modules/compliance-management/routes/staff-qualification.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/status
> 查询 /api/compliance/status
自动从 modules/compliance-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/uptime-statistics/batch-operation-logs
> 创建/提交 /api/compliance/uptime-statistics/batch-operation-logs
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/uptime-statistics/calculate
> 创建/提交 /api/compliance/uptime-statistics/calculate
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/uptime-statistics/operation-logs
> 查询 /api/compliance/uptime-statistics/operation-logs
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## POST /api/compliance/uptime-statistics/operation-logs
> 创建/提交 /api/compliance/uptime-statistics/operation-logs
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/uptime-statistics/overview
> 查询 /api/compliance/uptime-statistics/overview
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/compliance/uptime-statistics/statistics
> 查询 /api/compliance/uptime-statistics/statistics
自动从 modules/compliance-management/routes/uptime-statistics.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: compliance

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
## GET /api/dashboard
> 获取仪表盘统计数据
获取仪表盘所需的各类统计数据
**Tags:** 仪表盘

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
| data.overview | object | no |  |
| data.overview.total_assets | integer | no |  |
| data.overview.total_value | number | no |  |
| data.overview.active_count | integer | no |  |
| data.overview.idle_count | integer | no |  |
| data.overview.maintenance_count | integer | no |  |
| data.overview.scrapped_count | integer | no |  |
| data.overview.transfer_count | integer | no |  |
| data.alerts | object | no |  |
| data.alerts.warranty_expiring | integer | no |  |
| data.alerts.low_value_assets | integer | no |  |
| data.alerts.pending_maintenance | integer | no |  |
| data.alerts.pending_transfers | integer | no |  |
| data.recent_assets | array&lt;unknown&gt; | no |  |
| data.status_distribution | object | no |  |

#### 500
服务器错误
## GET /api/dashboard-configs
> 查询 /api/dashboard-configs
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

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
## POST /api/dashboard-configs
> 创建/提交 /api/dashboard-configs
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

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
## DELETE /api/dashboard-configs/{id}
> 删除 /api/dashboard-configs/{id}
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

### Authentication
bearerAuth
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
## GET /api/dashboard-configs/{id}
> 查询 /api/dashboard-configs/{id}
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

### Authentication
bearerAuth
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
## PUT /api/dashboard-configs/{id}
> 更新 /api/dashboard-configs/{id}
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

### Authentication
bearerAuth
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
## GET /api/dashboard-configs/{id}/data
> 查询 /api/dashboard-configs/{id}/data
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

### Authentication
bearerAuth
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
## GET /api/dashboard-configs/active
> 查询 /api/dashboard-configs/active
自动从 routes/dashboard-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: dashboard-configs

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
## GET /api/dashboard/realtime
> 获取实时统计数据
获取实时统计数据用于刷新
**Tags:** 仪表盘

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
| data.total_assets | integer | no |  |
| data.today_added | integer | no |  |
| data.timestamp | string | no |  |

#### 500
服务器错误
## GET /api/departments
> 获取部门列表
获取所有部门，支持关键词搜索和分页
**Tags:** 部门管理

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

## POST /api/departments
> 创建部门
创建新部门
**Tags:** 部门管理

### Authentication
BearerAuth
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
| department_name | string | yes | 部门名称 |
| parent_code | string | no | 父部门编码 |

### Responses
#### 200
创建成功
## DELETE /api/departments/{id}
> 删除部门
**Tags:** 部门管理

### Authentication
BearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 部门ID |

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
## GET /api/departments/{id}
> 获取部门详情
**Tags:** 部门管理

### Authentication
BearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 部门ID |

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
部门详情
## PUT /api/departments/{id}
> 更新部门
更新部门信息
**Tags:** 部门管理

### Authentication
BearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 部门ID |

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
| department_name | string | no | 部门名称 |
| parent_code | string | no | 父部门编码 |

### Responses
#### 200
更新成功
## GET /api/departments/tree
> 查询 /api/departments/tree
自动从 routes/departments.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: departments

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
## GET /api/depreciation
> 获取折旧列表
分页获取资产折旧数据
**Tags:** 折旧管理

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
## GET /api/depreciation/{id}
> 获取资产折旧详情
获取单个资产的折旧详情
**Tags:** 折旧管理

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 资产ID |

### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| method | enum(straight_line, declining_balance, units_of_production) | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |
| residual_rate | number | no | 残值率 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
#### 400
无效的资产ID
#### 404
资产不存在
#### 500
服务器错误
## GET /api/depreciation/{id}(\\d+)
> 查询 /api/depreciation/{id}(\\d+)
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

### Authentication
bearerAuth
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
## POST /api/depreciation/calculate
> 计算折旧
批量计算资产折旧
**Tags:** 折旧管理

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
| assets | array&lt;object&gt; | yes |  |
| assets[] | object | no |  |
| method | enum(straight_line, declining_balance, units_of_production) | no |  |
| as_of_date | string | no |  |
| residual_rate | number | no |  |

### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## GET /api/depreciation/depreciation
> 查询 /api/depreciation/depreciation
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/{id}(\\d+)
> 查询 /api/depreciation/depreciation/{id}(\\d+)
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

### Authentication
bearerAuth
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
## POST /api/depreciation/depreciation/calculate
> 创建/提交 /api/depreciation/depreciation/calculate
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/export
> 查询 /api/depreciation/depreciation/export
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/methods
> 查询 /api/depreciation/depreciation/methods
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/summary/by-department
> 查询 /api/depreciation/depreciation/summary/by-department
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/summary/by-month
> 查询 /api/depreciation/depreciation/summary/by-month
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/depreciation/summary/by-type
> 查询 /api/depreciation/depreciation/summary/by-type
自动从 routes/depreciation.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: depreciation

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
## GET /api/depreciation/export
> 导出折旧数据
**Tags:** 折旧管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| format | enum(csv, json) | no | 导出格式 |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |

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
## GET /api/depreciation/methods
> 获取折旧方法列表
**Tags:** 折旧管理

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
## GET /api/depreciation/summary/by-department
> 按部门汇总折旧数据
**Tags:** 折旧管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |
| residual_rate | number | no | 残值率 |

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
## GET /api/depreciation/summary/by-month
> 按月份查看折旧趋势
**Tags:** 折旧管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| months | integer | no | 月份数 |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |

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
## GET /api/depreciation/summary/by-type
> 按类型汇总折旧数据
**Tags:** 折旧管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| method | string | no | 折旧方法 |
| as_of_date | string | no | 截止日期 |
| residual_rate | number | no | 残值率 |

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
## GET /api/enhanced-permissions/audit-logs
> 查询 /api/enhanced-permissions/audit-logs
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

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
## GET /api/enhanced-permissions/data-scopes/definitions
> 查询 /api/enhanced-permissions/data-scopes/definitions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

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
## GET /api/enhanced-permissions/resource-permissions
> 查询 /api/enhanced-permissions/resource-permissions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

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
## GET /api/enhanced-permissions/roles/{role}/data-scope
> 查询 /api/enhanced-permissions/roles/{role}/data-scope
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
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
## PUT /api/enhanced-permissions/roles/{role}/data-scope
> 更新 /api/enhanced-permissions/roles/{role}/data-scope
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
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
## GET /api/enhanced-permissions/users/{userId}/data-scope
> 查询 /api/enhanced-permissions/users/{userId}/data-scope
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## PUT /api/enhanced-permissions/users/{userId}/data-scope
> 更新 /api/enhanced-permissions/users/{userId}/data-scope
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## GET /api/enhanced-permissions/users/{userId}/menu-permissions
> 查询 /api/enhanced-permissions/users/{userId}/menu-permissions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## POST /api/enhanced-permissions/users/{userId}/menu-permissions
> 创建/提交 /api/enhanced-permissions/users/{userId}/menu-permissions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## DELETE /api/enhanced-permissions/users/{userId}/menu-permissions/{menuKey}
> 删除 /api/enhanced-permissions/users/{userId}/menu-permissions/{menuKey}
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |
| menuKey | string | yes |  |

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
## GET /api/enhanced-permissions/users/{userId}/permissions
> 查询 /api/enhanced-permissions/users/{userId}/permissions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## POST /api/enhanced-permissions/users/{userId}/permissions
> 创建/提交 /api/enhanced-permissions/users/{userId}/permissions
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## DELETE /api/enhanced-permissions/users/{userId}/permissions/{permission}
> 删除 /api/enhanced-permissions/users/{userId}/permissions/{permission}
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |
| permission | string | yes |  |

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
## POST /api/enhanced-permissions/users/{userId}/permissions/deny
> 创建/提交 /api/enhanced-permissions/users/{userId}/permissions/deny
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |

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
## DELETE /api/enhanced-permissions/users/{userId}/permissions/deny/{permission}
> 删除 /api/enhanced-permissions/users/{userId}/permissions/deny/{permission}
自动从 routes/enhanced-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: enhanced-permissions

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | yes |  |
| permission | string | yes |  |

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
## GET /api/health
> 健康检查
检查服务器、数据库和Redis连接状态
**Tags:** 系统

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
服务正常
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| status | enum(healthy, degraded, unhealthy) | no |  |
| timestamp | string | no |  |
| uptime | integer | no |  |
| version | string | no |  |
| checks | object | no |  |
| message | string | no |  |
| database | string | no |  |
| redis | string | no |  |

#### 503
服务异常（数据库连接失败）
##### application/json
### Response Schema (503 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | no |  |
| message | string | no |  |
| database | string | no |  |
| redis | string | no |  |
| error | string | no |  |

## GET /api/health/alive
> 存活检查
Kubernetes等编排系统使用的存活探针
**Tags:** 系统监控

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
服务存活
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| alive | boolean | no |  |
| timestamp | string | no |  |

## GET /api/health/circuit-breakers
> 获取断路器状态
**Tags:** 系统监控

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
## POST /api/health/circuit-breakers/{name}/reset
> 重置断路器
**Tags:** 系统监控

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | yes | 断路器名称 |

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
重置成功
## GET /api/health/detailed
> 详细健康状态
获取详细的健康状态信息
**Tags:** 系统监控

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
| status | string | no |  |
| timestamp | string | no |  |
| uptime | integer | no |  |
| components | object | no |  |
| circuitBreakers | object | no |  |

#### 500
服务器错误
## GET /api/health/metrics
> 获取监控指标
Prometheus格式的监控指标
**Tags:** 系统监控

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
##### text/plain
### Response Schema (200 text/plain)
无
#### 500
服务器错误
## GET /api/health/ready
> 就绪检查
Kubernetes等编排系统使用的就绪探针
**Tags:** 系统监控

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
服务就绪
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| ready | boolean | no |  |
| timestamp | string | no |  |

#### 503
服务未就绪
## GET /api/i18n/locales
> 获取支持的语言列表
**Tags:** Internationalization

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
语言列表
## GET /api/i18n/messages/{locale}
> 获取指定语言的翻译消息
**Tags:** Internationalization

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| locale | string | yes | 语言代码 (zh, en) |

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
翻译消息
## POST /api/i18n/switch
> 切换用户语言偏好（需要登录）
**Tags:** Internationalization

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
| locale | string | no |  |

### Responses
#### 200
切换成功
## POST /api/i18n/translate
> 翻译文本
**Tags:** Internationalization

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
| key | string | no |  |
| locale | string | no |  |
| namespace | string | no |  |
| params | object | no |  |

### Responses
#### 200
翻译结果
## GET /api/idle
> 查询 /api/idle
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

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
## POST /api/idle
> 创建/提交 /api/idle
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

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
## DELETE /api/idle/{id}
> 删除 /api/idle/{id}
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

### Authentication
bearerAuth
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
## GET /api/idle/{id}
> 查询 /api/idle/{id}
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

### Authentication
bearerAuth
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
## PUT /api/idle/{id}/allocate
> 更新 /api/idle/{id}/allocate
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

### Authentication
bearerAuth
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
## PUT /api/idle/{id}/cancel
> 更新 /api/idle/{id}/cancel
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

### Authentication
bearerAuth
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
## GET /api/idle/statistics
> 查询 /api/idle/statistics
自动从 routes/idle.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: idle

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
## GET /api/integration/channels
> 获取所有集成渠道
**Tags:** 集成渠道

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
## DELETE /api/integration/channels/{channel}
> 删除渠道配置
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
## GET /api/integration/channels/{channel}
> 获取单个渠道配置
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
## POST /api/integration/channels/{channel}
> 保存渠道配置
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
成功
#### 500
服务器错误
## POST /api/integration/channels/{channel}/send-test
> 发送测试消息
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
| recipient | string | no | 接收人 |

### Responses
#### 200
成功
#### 500
服务器错误
## GET /api/integration/channels/{channel}/templates
> 获取消息模板
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
## POST /api/integration/channels/{channel}/templates
> 保存消息模板
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
成功
#### 500
服务器错误
## DELETE /api/integration/channels/{channel}/templates/{templateId}
> 删除消息模板
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |
| templateId | string | yes | 模板ID |

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
## POST /api/integration/channels/{channel}/test
> 测试渠道连接
**Tags:** 集成渠道

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes | 渠道名称 |

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
| config | object | no | 渠道配置 |

### Responses
#### 200
成功
#### 500
服务器错误
## GET /api/intelligent-alerts
> 获取预警列表
分页获取预警列表
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | no | 预警类型 |
| urgency | string | no | 紧急程度 |
| unreadOnly | boolean | no | 仅未读 |
| status | string | no | 状态 |
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
成功
#### 500
服务器错误
## POST /api/intelligent-alerts/{alertId}/handle
> 标记单条预警已处理
**Tags:** 智能预警

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
## POST /api/intelligent-alerts/{alertId}/read
> 标记单条预警已读
**Tags:** 智能预警

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
## POST /api/intelligent-alerts/{alertId}/unhandle
> 撤销单条预警已处理状态
**Tags:** 智能预警

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
无
### Responses
#### 200
成功
#### 400
失败
#### 500
服务器错误
## POST /api/intelligent-alerts/handle-all
> 批量标记预警已处理
**Tags:** 智能预警

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
| type | string | no |  |
| urgency | string | no |  |
| unreadOnly | boolean | no |  |
| status | string | no |  |
| handlerNotes | string | no |  |

### Responses
#### 200
成功
#### 400
失败
#### 500
服务器错误
## GET /api/intelligent-alerts/inspections
> 特种设备检验到期预警
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| days | integer | no | 提前天数 |

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
## GET /api/intelligent-alerts/maintenance
> 保养到期预警
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| days | integer | no | 提前天数 |

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
## GET /api/intelligent-alerts/overview
> 获取预警概览统计
获取各类预警的统计数据
**Tags:** 智能预警

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

#### 500
服务器错误
## GET /api/intelligent-alerts/qualifications
> 资质到期预警
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| days | integer | no | 提前天数 |

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
## POST /api/intelligent-alerts/read-all
> 批量标记预警已读
**Tags:** 智能预警

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
| type | string | no |  |
| urgency | string | no |  |
| unreadOnly | boolean | no |  |
| status | string | no |  |

### Responses
#### 200
成功
#### 400
失败
#### 500
服务器错误
## GET /api/intelligent-alerts/safety
> 安全检测到期预警
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| days | integer | no | 提前天数 |

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
## GET /api/intelligent-alerts/settings
> 获取用户预警设置
**Tags:** 智能预警

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
## POST /api/intelligent-alerts/settings
> 保存用户预警设置
**Tags:** 智能预警

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
无
### Responses
#### 200
成功
#### 500
服务器错误
## GET /api/intelligent-alerts/uptime
> 开机率异常预警
**Tags:** 智能预警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| threshold | integer | no | 阈值百分比 |

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
## GET /api/inventory
> 查询 /api/inventory
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## POST /api/inventory
> 创建/提交 /api/inventory
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## GET /api/inventory-discrepancies
> 获取盘点差异列表
分页获取盘点差异记录
**Tags:** 盘点差异

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| inventory_id | integer | no | 盘点记录ID |
| asset_code | string | no | 资产编号 |
| handling_status | enum(待处理, 已处理, 已忽略) | no | 处理状态 |

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
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].inventory_id | integer | no |  |
| data[].asset_code | string | no |  |
| data[].discrepancy_type | string | no |  |
| data[].discrepancy_desc | string | no |  |
| data[].handling_status | string | no |  |
| data[].handling_method | string | no |  |
| data[].inventory_no | string | no |  |
| data[].asset_name | string | no |  |
| data[].brand | string | no |  |
| data[].model | string | no |  |
| pagination | object | no |  |

#### 500
服务器错误
## GET /api/inventory-discrepancies/{id}
> 获取盘点差异详情
**Tags:** 盘点差异

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点差异ID |

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
#### 404
盘点差异不存在
#### 500
服务器错误
## PUT /api/inventory-discrepancies/{id}/handle
> 处理盘点差异
处理单个盘点差异记录
**Tags:** 盘点差异

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点差异ID |

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
| handling_status | enum(待处理, 已处理, 已忽略) | yes | 处理状态 |
| handling_method | string | yes | 处理方式 |
| handling_notes | string | no | 处理备注 |

### Responses
#### 200
处理成功
#### 400
该差异已经处理过
#### 404
盘点差异不存在
#### 500
服务器错误
## GET /api/inventory-discrepancies/{inventory_id}/statistics
> 获取盘点差异统计
**Tags:** 盘点差异

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inventory_id | integer | yes | 盘点记录ID |

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
| data.total | integer | no |  |
| data.statusStats | object | no |  |
| data.typeStats | object | no |  |

#### 500
服务器错误
## POST /api/inventory-discrepancies/batch-handle
> 批量处理盘点差异
**Tags:** 盘点差异

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
| ids | array&lt;integer&gt; | yes | 盘点差异ID列表 |
| ids[] | integer | no |  |
| handling_status | enum(待处理, 已处理, 已忽略) | yes |  |
| handling_method | string | yes |  |
| handling_notes | string | no |  |

### Responses
#### 200
处理成功
#### 400
参数错误
#### 404
部分盘点差异不存在
#### 500
服务器错误
## POST /api/inventory-discrepancies/generate-from-details
> 自动生成盘点差异记录
根据盘点明细自动生成差异记录
**Tags:** 盘点差异

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
| inventory_id | integer | yes | 盘点记录ID |

### Responses
#### 200
生成成功
#### 400
盘点ID不能为空
#### 404
盘点记录不存在
#### 500
服务器错误
## GET /api/inventory-plans
> 获取盘点计划列表
分页获取所有盘点计划
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| status | enum(draft, active, completed, cancelled) | no | 计划状态 |

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
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].plan_no | string | no |  |
| data[].plan_name | string | no |  |
| data[].start_date | string | no |  |
| data[].end_date | string | no |  |
| data[].status | string | no |  |
| data[].remark | string | no |  |
| data[].created_by | string | no |  |
| data[].created_at | string | no |  |
| pagination | object | no |  |
| pagination.page | integer | no |  |
| pagination.pageSize | integer | no |  |
| pagination.total | integer | no |  |
| pagination.totalPages | integer | no |  |

#### 500
服务器错误
## POST /api/inventory-plans
> 创建盘点计划
创建新的盘点计划
**Tags:** 盘点计划

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
| plan_no | string | yes | 计划编号 |
| plan_name | string | yes | 计划名称 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |
| status | enum(draft, active, completed, cancelled) | no | 计划状态 |
| remark | string | no | 备注 |

### Responses
#### 201
创建成功
#### 400
参数错误
#### 500
服务器错误
## DELETE /api/inventory-plans/{id}
> 删除盘点计划
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
#### 404
盘点计划不存在
#### 500
服务器错误
## GET /api/inventory-plans/{id}
> 获取盘点计划详情
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
#### 404
盘点计划不存在
#### 500
服务器错误
## PUT /api/inventory-plans/{id}
> 更新盘点计划
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
| plan_no | string | yes |  |
| plan_name | string | yes |  |
| start_date | string | no |  |
| end_date | string | no |  |
| status | enum(draft, active, completed, cancelled) | no |  |
| remark | string | no |  |

### Responses
#### 200
更新成功
#### 400
参数错误
#### 404
盘点计划不存在
#### 500
服务器错误
## PUT /api/inventory-plans/{id}/activate
> 激活盘点计划
将盘点计划状态改为激活
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
激活成功
#### 400
已经是激活状态
#### 404
盘点计划不存在
#### 500
服务器错误
## PUT /api/inventory-plans/{id}/cancel
> 取消盘点计划
将盘点计划状态改为已取消
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
取消成功
#### 400
已完成或已取消的计划不能再取消
#### 404
盘点计划不存在
#### 500
服务器错误
## PUT /api/inventory-plans/{id}/complete
> 完成盘点计划
将盘点计划状态改为已完成
**Tags:** 盘点计划

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点计划ID |

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
完成成功
#### 400
只有激活状态的计划才能完成
#### 404
盘点计划不存在
#### 500
服务器错误
## GET /api/inventory-reports/export/inventory-details/{inventory_id}
> 查询 /api/inventory-reports/export/inventory-details/{inventory_id}
自动从 routes/inventory-reports.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory-reports

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inventory_id | string | yes |  |

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
## GET /api/inventory-reports/export/inventory-discrepancies
> 查询 /api/inventory-reports/export/inventory-discrepancies
自动从 routes/inventory-reports.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory-reports

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
## GET /api/inventory-reports/export/inventory-plans
> 查询 /api/inventory-reports/export/inventory-plans
自动从 routes/inventory-reports.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory-reports

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
## GET /api/inventory-reports/export/inventory-records
> 查询 /api/inventory-reports/export/inventory-records
自动从 routes/inventory-reports.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory-reports

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
## GET /api/inventory-reports/export/inventory-tasks
> 查询 /api/inventory-reports/export/inventory-tasks
自动从 routes/inventory-reports.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory-reports

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
## GET /api/inventory-tasks
> 获取盘点任务列表
分页获取盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| inventory_id | integer | no | 盘点记录ID |
| assignee | string | no | 负责人用户名 |
| status | enum(待分配, 已分配, 进行中, 已完成, 已取消) | no | 任务状态 |

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
## POST /api/inventory-tasks
> 创建盘点任务
创建新的盘点任务
**Tags:** 盘点任务

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
| inventory_id | integer | yes | 盘点记录ID |
| task_name | string | yes | 任务名称 |
| assignee | string | yes | 负责人用户名 |
| assignee_name | string | yes | 负责人姓名 |
| department_code | string | no | 部门代码 |
| location | string | no | 盘点位置 |
| estimated_count | integer | no | 预估盘点数量 |

### Responses
#### 201
创建成功
#### 400
参数错误
#### 404
盘点记录不存在
#### 500
服务器错误
## DELETE /api/inventory-tasks/{id}
> 删除盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
#### 404
盘点任务不存在
#### 500
服务器错误
## GET /api/inventory-tasks/{id}
> 获取盘点任务详情
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
#### 404
盘点任务不存在
#### 500
服务器错误
## PUT /api/inventory-tasks/{id}
> 更新盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
| task_name | string | no |  |
| assignee | string | no |  |
| assignee_name | string | no |  |
| department_code | string | no |  |
| location | string | no |  |
| estimated_count | integer | no |  |

### Responses
#### 200
更新成功
#### 404
盘点任务不存在
#### 500
服务器错误
## PUT /api/inventory-tasks/{id}/assign
> 分配盘点任务
将待分配状态的任务分配给负责人
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
分配成功
#### 400
只有待分配状态的任务才能分配
#### 404
盘点任务不存在
#### 500
服务器错误
## PUT /api/inventory-tasks/{id}/cancel
> 取消盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
取消成功
#### 400
已完成或已取消的任务不能再取消
#### 404
盘点任务不存在
#### 500
服务器错误
## PUT /api/inventory-tasks/{id}/complete
> 完成盘点任务
任务负责人完成盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
| actual_count | integer | no | 实际盘点数量 |

### Responses
#### 200
完成成功
#### 400
只有进行中状态的任务才能完成
#### 403
只有任务负责人才能完成任务
#### 404
盘点任务不存在
#### 500
服务器错误
## PUT /api/inventory-tasks/{id}/start
> 开始盘点任务
任务负责人开始执行盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 盘点任务ID |

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
开始成功
#### 400
只有已分配状态的任务才能开始
#### 403
只有任务负责人才能开始任务
#### 404
盘点任务不存在
#### 500
服务器错误
## GET /api/inventory-tasks/my/tasks
> 获取我的任务
获取当前用户负责的盘点任务
**Tags:** 盘点任务

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| status | enum(待分配, 已分配, 进行中, 已完成, 已取消) | no | 任务状态 |

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
## DELETE /api/inventory/{id}
> 删除 /api/inventory/{id}
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## GET /api/inventory/{id}
> 查询 /api/inventory/{id}
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## PUT /api/inventory/{id}
> 更新 /api/inventory/{id}
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## POST /api/inventory/{id}/complete
> 创建/提交 /api/inventory/{id}/complete
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## POST /api/inventory/{id}/details
> 创建/提交 /api/inventory/{id}/details
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## DELETE /api/inventory/{id}/details/{detailId}
> 删除 /api/inventory/{id}/details/{detailId}
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |
| detailId | string | yes |  |

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
## PUT /api/inventory/{id}/details/{detailId}
> 更新 /api/inventory/{id}/details/{detailId}
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |
| detailId | string | yes |  |

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
## POST /api/inventory/{id}/details/batch
> 创建/提交 /api/inventory/{id}/details/batch
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## POST /api/inventory/{id}/scan
> 创建/提交 /api/inventory/{id}/scan
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## GET /api/inventory/{id}/scan-logs
> 查询 /api/inventory/{id}/scan-logs
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## GET /api/inventory/{id}/statistics
> 查询 /api/inventory/{id}/statistics
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## PUT /api/inventory/{id}/status
> 更新 /api/inventory/{id}/status
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

### Authentication
bearerAuth
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
## GET /api/inventory/self/assets
> 查询 /api/inventory/self/assets
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## POST /api/inventory/self/confirm
> 创建/提交 /api/inventory/self/confirm
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## GET /api/inventory/self/windows
> 查询 /api/inventory/self/windows
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## GET /api/inventory/statistics
> 查询 /api/inventory/statistics
自动从 routes/inventory.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: inventory

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
## GET /api/iot
> 查询 /api/iot
自动从 modules/iot-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot-devices
> 查询 /api/iot-devices
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

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
## POST /api/iot-devices
> 创建/提交 /api/iot-devices
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

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
## GET /api/iot-devices/{deviceId}/assets
> 查询 /api/iot-devices/{deviceId}/assets
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## GET /api/iot-devices/{deviceId}/data
> 查询 /api/iot-devices/{deviceId}/data
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## POST /api/iot-devices/{deviceId}/data
> 创建/提交 /api/iot-devices/{deviceId}/data
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## DELETE /api/iot-devices/{id}
> 删除 /api/iot-devices/{id}
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## GET /api/iot-devices/{id}
> 查询 /api/iot-devices/{id}
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## PUT /api/iot-devices/{id}
> 更新 /api/iot-devices/{id}
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## GET /api/iot-devices/assets/{assetCode}/devices
> 查询 /api/iot-devices/assets/{assetCode}/devices
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## POST /api/iot-devices/assets/{assetCode}/link
> 创建/提交 /api/iot-devices/assets/{assetCode}/link
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## POST /api/iot-devices/assets/{assetCode}/unlink
> 创建/提交 /api/iot-devices/assets/{assetCode}/unlink
自动从 routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot-devices

### Authentication
bearerAuth
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
## GET /api/iot/asset-monitoring/assets/{assetCode}/error-reports
> 查询 /api/iot/asset-monitoring/assets/{assetCode}/error-reports
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/asset-monitoring/assets/{assetCode}/latest
> 查询 /api/iot/asset-monitoring/assets/{assetCode}/latest
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/asset-monitoring/assets/{assetCode}/series
> 查询 /api/iot/asset-monitoring/assets/{assetCode}/series
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/asset-monitoring/devices/{deviceId}/latest
> 查询 /api/iot/asset-monitoring/devices/{deviceId}/latest
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## POST /api/iot/asset-monitoring/external-report
> 创建/提交 /api/iot/asset-monitoring/external-report
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/asset-monitoring/ingest
> 创建/提交 /api/iot/asset-monitoring/ingest
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/asset-monitoring/ingest/batch
> 创建/提交 /api/iot/asset-monitoring/ingest/batch
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/asset-monitoring/pipeline/docs
> 查询 /api/iot/asset-monitoring/pipeline/docs
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/asset-monitoring/pipeline/health
> 查询 /api/iot/asset-monitoring/pipeline/health
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/asset-monitoring/sample
> 创建/提交 /api/iot/asset-monitoring/sample
自动从 modules/iot-management/routes/asset-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/devices
> 查询 /api/iot/devices
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/devices
> 创建/提交 /api/iot/devices
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/devices/{deviceId}/assets
> 查询 /api/iot/devices/{deviceId}/assets
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## DELETE /api/iot/devices/{id}
> 删除 /api/iot/devices/{id}
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/devices/{id}
> 查询 /api/iot/devices/{id}
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## PUT /api/iot/devices/{id}
> 更新 /api/iot/devices/{id}
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/devices/assets/{assetCode}/devices
> 查询 /api/iot/devices/assets/{assetCode}/devices
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## POST /api/iot/devices/assets/{assetCode}/link
> 创建/提交 /api/iot/devices/assets/{assetCode}/link
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## POST /api/iot/devices/assets/{assetCode}/unlink
> 创建/提交 /api/iot/devices/assets/{assetCode}/unlink
自动从 modules/iot-management/routes/iot-devices.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/environment-monitoring/assets/{assetCode}/latest
> 查询 /api/iot/environment-monitoring/assets/{assetCode}/latest
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/environment-monitoring/assets/{assetCode}/series
> 查询 /api/iot/environment-monitoring/assets/{assetCode}/series
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/environment-monitoring/devices/{deviceId}/latest
> 查询 /api/iot/environment-monitoring/devices/{deviceId}/latest
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## POST /api/iot/environment-monitoring/ingest
> 创建/提交 /api/iot/environment-monitoring/ingest
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/environment-monitoring/ingest/batch
> 创建/提交 /api/iot/environment-monitoring/ingest/batch
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/environment-monitoring/pipeline/docs
> 查询 /api/iot/environment-monitoring/pipeline/docs
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/environment-monitoring/pipeline/health
> 查询 /api/iot/environment-monitoring/pipeline/health
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/environment-monitoring/sample
> 创建/提交 /api/iot/environment-monitoring/sample
自动从 modules/iot-management/routes/environment-monitoring.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/health
> 查询 /api/iot/health
自动从 modules/iot-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/location/assets/{assetCode}/location
> 查询 /api/iot/location/assets/{assetCode}/location
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## POST /api/iot/location/assets/{assetCode}/location
> 创建/提交 /api/iot/location/assets/{assetCode}/location
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/location/assets/{assetCode}/location/history
> 查询 /api/iot/location/assets/{assetCode}/location/history
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## POST /api/iot/location/assets/in-area
> 创建/提交 /api/iot/location/assets/in-area
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/location/assets/locations
> 创建/提交 /api/iot/location/assets/locations
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/location/beacon-location
> 创建/提交 /api/iot/location/beacon-location
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/location/devices/{deviceId}/data
> 创建/提交 /api/iot/location/devices/{deviceId}/data
自动从 modules/iot-management/routes/asset-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## GET /api/iot/patient-volume/assets/{assetCode}/latest
> 查询 /api/iot/patient-volume/assets/{assetCode}/latest
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/patient-volume/assets/{assetCode}/patients
> 查询 /api/iot/patient-volume/assets/{assetCode}/patients
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/patient-volume/assets/{assetCode}/series
> 查询 /api/iot/patient-volume/assets/{assetCode}/series
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/patient-volume/assets/usage-stats
> 查询 /api/iot/patient-volume/assets/usage-stats
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/patient-volume/assets/usage-stats/all
> 查询 /api/iot/patient-volume/assets/usage-stats/all
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/patient-volume/ingest
> 创建/提交 /api/iot/patient-volume/ingest
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/patient-volume/ingest/batch
> 创建/提交 /api/iot/patient-volume/ingest/batch
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/patient-volume/pipeline/docs
> 查询 /api/iot/patient-volume/pipeline/docs
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/patient-volume/pipeline/health
> 查询 /api/iot/patient-volume/pipeline/health
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/patient-volume/records/all
> 查询 /api/iot/patient-volume/records/all
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/patient-volume/records/recent
> 查询 /api/iot/patient-volume/records/recent
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/patient-volume/sample
> 创建/提交 /api/iot/patient-volume/sample
自动从 modules/iot-management/routes/patient-volume.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/zone-location/assets/{assetCode}/latest
> 查询 /api/iot/zone-location/assets/{assetCode}/latest
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/zone-location/assets/{assetCode}/series
> 查询 /api/iot/zone-location/assets/{assetCode}/series
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
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
## GET /api/iot/zone-location/devices/{deviceId}/latest
> 查询 /api/iot/zone-location/devices/{deviceId}/latest
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| deviceId | string | yes |  |

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
## POST /api/iot/zone-location/ingest
> 创建/提交 /api/iot/zone-location/ingest
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/zone-location/ingest/batch
> 创建/提交 /api/iot/zone-location/ingest/batch
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/zone-location/pipeline/docs
> 查询 /api/iot/zone-location/pipeline/docs
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/iot/zone-location/pipeline/health
> 查询 /api/iot/zone-location/pipeline/health
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## POST /api/iot/zone-location/sample
> 创建/提交 /api/iot/zone-location/sample
自动从 modules/iot-management/routes/zone-location.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: iot

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
## GET /api/location-alerts
> 获取位置告警列表
分页获取位置告警记录
**Tags:** 位置告警

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| is_handled | boolean | no | 是否已处理 |
| alert_type | string | no | 告警类型 |
| alert_level | string | no | 告警级别 |
| asset_code | string | no | 资产编号 |

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
## DELETE /api/location-alerts/{id}
> 删除位置告警
**Tags:** 位置告警

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 告警ID |

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
#### 404
告警记录不存在
#### 500
服务器错误
## PUT /api/location-alerts/{id}/handle
> 处理位置告警
**Tags:** 位置告警

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 告警ID |

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
| handle_result | string | no | 处理结果 |
| remark | string | no | 备注 |

### Responses
#### 200
成功
#### 404
告警记录不存在
#### 500
服务器错误
## POST /api/location-alerts/batch/handle
> 批量处理位置告警
**Tags:** 位置告警

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
| ids | array&lt;integer&gt; | yes | 告警ID列表 |
| ids[] | integer | no |  |
| handle_result | string | no | 处理结果 |

### Responses
#### 200
成功
#### 400
参数错误
#### 404
告警记录不存在
#### 500
服务器错误
## GET /api/location-alerts/stats
> 获取位置告警统计
**Tags:** 位置告警

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
| data.total | integer | no |  |
| data.pending | integer | no |  |
| data.by_level | array&lt;object&gt; | no |  |
| data.by_level[].alert_level | string | no |  |
| data.by_level[].count | integer | no |  |
| data.by_type | array&lt;object&gt; | no |  |
| data.by_type[].alert_type | string | no |  |
| data.by_type[].count | integer | no |  |

#### 500
服务器错误
## GET /api/location-codes
> 查询 /api/location-codes
自动从 routes/location-codes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: location-codes

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
## POST /api/location-codes
> 创建/提交 /api/location-codes
自动从 routes/location-codes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: location-codes

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
## DELETE /api/location-codes/{id}
> 删除 /api/location-codes/{id}
自动从 routes/location-codes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: location-codes

### Authentication
bearerAuth
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
## GET /api/location-codes/{id}
> 查询 /api/location-codes/{id}
自动从 routes/location-codes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: location-codes

### Authentication
bearerAuth
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
## PUT /api/location-codes/{id}
> 更新 /api/location-codes/{id}
自动从 routes/location-codes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: location-codes

### Authentication
bearerAuth
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
## GET /api/maintenance/ai/analysis
> 获取维修分析
**Tags:** 维修AI

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
## POST /api/maintenance/ai/audio
> 处理音频文件
**Tags:** 维修AI

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
#### multipart/form-data
### Schema (multipart/form-data)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| audio | string | no | 音频文件 |
| conversationId | string | no | 对话ID |

### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## GET /api/maintenance/ai/debug-asset
> 调试：按资产编号查询资产
**Tags:** 维修AI

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | yes | 资产编号 |

### Header Parameters
无
### Cookie Parameters
无
### Request Body
无
### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## POST /api/maintenance/ai/feedback
> 提交学习反馈
**Tags:** 维修AI

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
| phrase | string | no | 用户原话摘要 |
| intent | string | no | 意图类型 |

### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## POST /api/maintenance/ai/init
> 初始化AI维修对话
**Tags:** 维修AI

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
## POST /api/maintenance/ai/message
> 发送AI维修对话消息
**Tags:** 维修AI

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
## GET /api/maintenance/ai/pending
> 获取AI待处理请求
**Tags:** 维修AI

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
## POST /api/maintenance/ai/submit-request
> 提交故障维修申请
**Tags:** 维修AI

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
## POST /api/maintenance/ai/test
> 测试AI维修功能
**Tags:** 维修AI

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
| message | string | no | 测试消息 |

### Responses
#### 200
成功
#### 400
参数错误
#### 500
服务器错误
## GET /api/maintenance/analysis/asset-history
> 查询 /api/maintenance/analysis/asset-history
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/analysis/cost-trend
> 查询 /api/maintenance/analysis/cost-trend
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/analysis/effectiveness-stats
> 查询 /api/maintenance/analysis/effectiveness-stats
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/analysis/frequency
> 查询 /api/maintenance/analysis/frequency
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/analysis/technician-performance
> 查询 /api/maintenance/analysis/technician-performance
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/analysis/type-distribution
> 查询 /api/maintenance/analysis/type-distribution
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/asset-types/secondary
> 查询 /api/maintenance/asset-types/secondary
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs
> 查询 /api/maintenance/costs
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/costs
> 创建/提交 /api/maintenance/costs
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/costs/{id}
> 删除 /api/maintenance/costs/{id}
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/costs/{id}
> 更新 /api/maintenance/costs/{id}
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/costs/analysis
> 查询 /api/maintenance/costs/analysis
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs/asset-type
> 查询 /api/maintenance/costs/asset-type
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs/department
> 查询 /api/maintenance/costs/department
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs/high-cost-assets
> 查询 /api/maintenance/costs/high-cost-assets
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs/maintenance-type
> 查询 /api/maintenance/costs/maintenance-type
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/costs/trend
> 查询 /api/maintenance/costs/trend
自动从 routes/maintenance/costs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/efficiency/asset-frequency
> 查询 /api/maintenance/efficiency/asset-frequency
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/efficiency/overview
> 查询 /api/maintenance/efficiency/overview
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/efficiency/response-time
> 查询 /api/maintenance/efficiency/response-time
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/efficiency/technician
> 查询 /api/maintenance/efficiency/technician
自动从 routes/maintenance/analytics.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/evaluations
> 查询 /api/maintenance/evaluations
自动从 routes/maintenance/evaluations.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/evaluations
> 创建/提交 /api/maintenance/evaluations
自动从 routes/maintenance/evaluations.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## PUT /api/maintenance/evaluations/{id}
> 更新 /api/maintenance/evaluations/{id}
自动从 routes/maintenance/evaluations.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/legacy/templates
> 查询 /api/maintenance/legacy/templates
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/legacy/templates
> 创建/提交 /api/maintenance/legacy/templates
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/legacy/templates/{id}
> 删除 /api/maintenance/legacy/templates/{id}
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/legacy/templates/{id}
> 查询 /api/maintenance/legacy/templates/{id}
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/legacy/templates/{id}
> 更新 /api/maintenance/legacy/templates/{id}
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/legacy/workorders
> 查询 /api/maintenance/legacy/workorders
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/legacy/workorders
> 创建/提交 /api/maintenance/legacy/workorders
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/legacy/workorders/{id}
> 删除 /api/maintenance/legacy/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/legacy/workorders/{id}
> 查询 /api/maintenance/legacy/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/legacy/workorders/{id}
> 更新 /api/maintenance/legacy/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/logs
> 查询 /api/maintenance/logs
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/logs
> 创建/提交 /api/maintenance/logs
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/logs/{id}
> 删除 /api/maintenance/logs/{id}
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/logs/{id}
> 查询 /api/maintenance/logs/{id}
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/logs/{id}
> 更新 /api/maintenance/logs/{id}
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/logs/{id}/attachments
> 查询 /api/maintenance/logs/{id}/attachments
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/logs/{id}/attachments
> 创建/提交 /api/maintenance/logs/{id}/attachments
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## DELETE /api/maintenance/logs/{logId}/attachments/{attachmentId}
> 删除 /api/maintenance/logs/{logId}/attachments/{attachmentId}
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| logId | string | yes |  |
| attachmentId | string | yes |  |

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
## GET /api/maintenance/logs/{logId}/attachments/{attachmentId}
> 查询 /api/maintenance/logs/{logId}/attachments/{attachmentId}
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| logId | string | yes |  |
| attachmentId | string | yes |  |

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
## GET /api/maintenance/logs/{logId}/attachments/{attachmentId}/download
> 查询 /api/maintenance/logs/{logId}/attachments/{attachmentId}/download
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| logId | string | yes |  |
| attachmentId | string | yes |  |

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
## GET /api/maintenance/plans
> 查询 /api/maintenance/plans
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/plans
> 创建/提交 /api/maintenance/plans
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/plans/{id}
> 删除 /api/maintenance/plans/{id}
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/plans/{id}
> 查询 /api/maintenance/plans/{id}
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/plans/{id}
> 更新 /api/maintenance/plans/{id}
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/plans/{id}/complete
> 创建/提交 /api/maintenance/plans/{id}/complete
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/plans/{id}/history
> 查询 /api/maintenance/plans/{id}/history
自动从 routes/maintenance/plans.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/reminders
> 查询 /api/maintenance/reminders
自动从 routes/maintenance/reminders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/reminders/check
> 查询 /api/maintenance/reminders/check
自动从 routes/maintenance/reminders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/reminders/config
> 创建/提交 /api/maintenance/reminders/config
自动从 routes/maintenance/reminders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/reminders/send
> 创建/提交 /api/maintenance/reminders/send
自动从 routes/maintenance/reminders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/requests
> 查询 /api/maintenance/requests
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/requests
> 创建/提交 /api/maintenance/requests
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/requests/{id}
> 删除 /api/maintenance/requests/{id}
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/requests/{id}
> 查询 /api/maintenance/requests/{id}
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/requests/{id}
> 更新 /api/maintenance/requests/{id}
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/requests/{id}/approve
> 创建/提交 /api/maintenance/requests/{id}/approve
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/requests/{id}/cancel
> 创建/提交 /api/maintenance/requests/{id}/cancel
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/requests/{id}/complete
> 创建/提交 /api/maintenance/requests/{id}/complete
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/requests/{id}/start
> 创建/提交 /api/maintenance/requests/{id}/start
自动从 routes/maintenance/requests.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/statistics
> 查询 /api/maintenance/statistics
自动从 routes/maintenance/logs.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/templates
> 查询 /api/maintenance/templates
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/templates
> 创建/提交 /api/maintenance/templates
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/templates/{id}
> 删除 /api/maintenance/templates/{id}
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/templates/{id}
> 更新 /api/maintenance/templates/{id}
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/templates/recommend
> 查询 /api/maintenance/templates/recommend
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/templates/recommend-by-asset
> 查询 /api/maintenance/templates/recommend-by-asset
自动从 routes/maintenance/templates.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage-records
> 查询 /api/maintenance/usage-records
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/usage-records
> 创建/提交 /api/maintenance/usage-records
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage-triggered
> 查询 /api/maintenance/usage-triggered
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/usage-triggered/{id}/process
> 创建/提交 /api/maintenance/usage-triggered/{id}/process
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/usage-triggered/check
> 创建/提交 /api/maintenance/usage-triggered/check
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/asset-usage
> 查询 /api/maintenance/usage/asset-usage
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/check-thresholds
> 查询 /api/maintenance/usage/check-thresholds
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/history
> 查询 /api/maintenance/usage/history
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/records
> 查询 /api/maintenance/usage/records
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/usage/records
> 创建/提交 /api/maintenance/usage/records
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/statistics
> 查询 /api/maintenance/usage/statistics
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/usage/triggered
> 查询 /api/maintenance/usage/triggered
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/usage/update
> 创建/提交 /api/maintenance/usage/update
自动从 routes/maintenance/usage.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/maintenance/workorders
> 查询 /api/maintenance/workorders
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## POST /api/maintenance/workorders
> 创建/提交 /api/maintenance/workorders
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## DELETE /api/maintenance/workorders/{id}
> 删除 /api/maintenance/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/workorders/{id}
> 查询 /api/maintenance/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## PUT /api/maintenance/workorders/{id}
> 更新 /api/maintenance/workorders/{id}
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/assign
> 创建/提交 /api/maintenance/workorders/{id}/assign
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/cancel
> 创建/提交 /api/maintenance/workorders/{id}/cancel
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/close
> 创建/提交 /api/maintenance/workorders/{id}/close
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/complete
> 创建/提交 /api/maintenance/workorders/{id}/complete
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/materials
> 创建/提交 /api/maintenance/workorders/{id}/materials
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## POST /api/maintenance/workorders/{id}/start
> 创建/提交 /api/maintenance/workorders/{id}/start
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

### Authentication
bearerAuth
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
## GET /api/maintenance/workorders/dispatch-panel
> 查询 /api/maintenance/workorders/dispatch-panel
自动从 routes/maintenance/workorders.router.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: maintenance

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
## GET /api/materials
> 查询 /api/materials
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## POST /api/materials
> 创建/提交 /api/materials
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## DELETE /api/materials/{id}
> 删除 /api/materials/{id}
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

### Authentication
bearerAuth
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
## PUT /api/materials/{id}
> 更新 /api/materials/{id}
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

### Authentication
bearerAuth
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
## GET /api/materials/inventory
> 查询 /api/materials/inventory
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## POST /api/materials/inventory/inbound
> 创建/提交 /api/materials/inventory/inbound
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## POST /api/materials/inventory/outbound
> 创建/提交 /api/materials/inventory/outbound
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## GET /api/materials/maintenance-requirements
> 查询 /api/materials/maintenance-requirements
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## POST /api/materials/maintenance-requirements
> 创建/提交 /api/materials/maintenance-requirements
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## POST /api/materials/maintenance-requirements/{id}/issue
> 创建/提交 /api/materials/maintenance-requirements/{id}/issue
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

### Authentication
bearerAuth
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
## GET /api/materials/transactions
> 查询 /api/materials/transactions
自动从 routes/materials.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: materials

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
## GET /api/menus/builtin-menus
> 查询 /api/menus/builtin-menus
自动从 routes/menus.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: menus

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
## GET /api/menus/default-menus
> 查询 /api/menus/default-menus
自动从 routes/menus.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: menus

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
## GET /api/menus/menu-tree
> 查询 /api/menus/menu-tree
自动从 routes/menus.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: menus

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
## GET /api/menus/menus
> 查询 /api/menus/menus
自动从 routes/menus.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: menus

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
## GET /api/message-integration
> 查询 /api/message-integration
自动从 modules/message-integration/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: message-integration

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
## GET /api/message-integration/channels
> 查询 /api/message-integration/channels
自动从 modules/message-integration/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: message-integration

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
## PUT /api/message-integration/channels/{channel}
> 更新 /api/message-integration/channels/{channel}
自动从 modules/message-integration/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: message-integration

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| channel | string | yes |  |

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
## GET /api/metrics
> 查询 /api/metrics
自动从 routes/health.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: metrics

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
## GET /api/module-configs/{moduleId}
> 查询 /api/module-configs/{moduleId}
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## PUT /api/module-configs/{moduleId}
> 更新 /api/module-configs/{moduleId}
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## GET /api/module-configs/{moduleId}/backup
> 查询 /api/module-configs/{moduleId}/backup
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## GET /api/module-configs/{moduleId}/menus
> 查询 /api/module-configs/{moduleId}/menus
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## PUT /api/module-configs/{moduleId}/menus
> 更新 /api/module-configs/{moduleId}/menus
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## POST /api/module-configs/{moduleId}/restore
> 创建/提交 /api/module-configs/{moduleId}/restore
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## POST /api/module-configs/{moduleId}/rollback
> 创建/提交 /api/module-configs/{moduleId}/rollback
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## GET /api/module-configs/{moduleId}/validate
> 查询 /api/module-configs/{moduleId}/validate
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## GET /api/module-configs/{moduleId}/versions
> 查询 /api/module-configs/{moduleId}/versions
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## POST /api/module-configs/{moduleId}/versions
> 创建/提交 /api/module-configs/{moduleId}/versions
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
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
## DELETE /api/module-configs/{moduleId}/versions/{versionId}
> 删除 /api/module-configs/{moduleId}/versions/{versionId}
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |
| versionId | string | yes |  |

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
## GET /api/module-configs/{moduleId}/versions/{versionId}/compare
> 查询 /api/module-configs/{moduleId}/versions/{versionId}/compare
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |
| versionId | string | yes |  |

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
## POST /api/module-configs/disable
> 创建/提交 /api/module-configs/disable
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

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
## POST /api/module-configs/enable
> 创建/提交 /api/module-configs/enable
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

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
## GET /api/module-configs/list
> 查询 /api/module-configs/list
自动从 routes/module-configs.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: module-configs

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
## GET /api/modules
> 查询 /api/modules
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

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
## DELETE /api/modules/{moduleId}
> 删除 /api/modules/{moduleId}
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## GET /api/modules/{moduleId}
> 查询 /api/modules/{moduleId}
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## PUT /api/modules/{moduleId}
> 更新 /api/modules/{moduleId}
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## GET /api/modules/{moduleId}/dependencies
> 查询 /api/modules/{moduleId}/dependencies
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## POST /api/modules/{moduleId}/dependencies
> 创建/提交 /api/modules/{moduleId}/dependencies
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## DELETE /api/modules/{moduleId}/dependencies/{depId}
> 删除 /api/modules/{moduleId}/dependencies/{depId}
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |
| depId | string | yes |  |

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
## GET /api/modules/{moduleId}/logs
> 查询 /api/modules/{moduleId}/logs
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## GET /api/modules/{moduleId}/status
> 查询 /api/modules/{moduleId}/status
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## PUT /api/modules/{moduleId}/status
> 更新 /api/modules/{moduleId}/status
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

### Authentication
bearerAuth
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
## GET /api/modules/check-conflicts
> 查询 /api/modules/check-conflicts
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

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
## GET /api/modules/dependency-graph
> 查询 /api/modules/dependency-graph
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

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
## GET /api/modules/list
> 查询 /api/modules/list
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

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
## POST /api/modules/register
> 创建/提交 /api/modules/register
自动从 routes/modules.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: modules

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
## GET /api/page-views/{pageKey}
> 获取页面访问量
获取指定页面的访问次数
**Tags:** 页面访问

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageKey | string | yes | 页面标识 |

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
| data.pageKey | string | no |  |
| data.viewCount | integer | no |  |

#### 400
无效的页面标识
#### 500
服务器错误
## POST /api/page-views/{pageKey}
> 增加页面访问量
为指定页面增加一次访问
**Tags:** 页面访问

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageKey | string | yes | 页面标识 |

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
#### 400
无效的页面标识
#### 500
服务器错误
## GET /api/procurement
> 获取采购申请列表
分页获取采购申请记录
**Tags:** 采购管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no | 页码 |
| pageSize | integer | no | 每页数量 |
| keyword | string | no | 搜索关键词 |
| department | string | no | 部门名称 |
| status | enum(draft, pending, approved, rejected, executing, completed) | no | 状态 |
| start_date | string | no | 开始日期 |
| end_date | string | no | 结束日期 |

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
## POST /api/procurement
> 创建采购申请
创建新的采购申请
**Tags:** 采购管理

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
| title | string | yes | 采购标题 |
| asset_name | string | no | 资产名称（别名） |
| department | string | no | 需求部门 |
| request_type | enum(purchase, lease, custom) | no | 采购类型 |
| request_date | string | no | 申请日期 |
| budget | number | no | 预算金额 |
| estimated_cost | number | no | 预估费用（别名） |
| justification | string | no | 申请理由 |
| reason | string | no | 原因（别名） |
| specification | string | no | 规格要求 |
| quantity | integer | no | 数量 |
| expected_date | string | no | 期望日期 |
| currency | string | no | 币种 |

### Responses
#### 201
创建成功
#### 400
参数错误
#### 500
服务器错误
## PUT /api/procurement/{id}
> 更新 /api/procurement/{id}
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

### Authentication
bearerAuth
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
## PUT /api/procurement/{id}/approve
> 审批采购申请
审批通过或驳回采购申请
**Tags:** 采购管理

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | integer | yes | 采购申请ID |

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
| action | enum(approve, reject) | no | 审批动作 |
| approved | boolean | no | 是否批准（与action二选一） |
| comment | string | no | 审批意见 |
| opinion | string | no | 审批意见（别名） |

### Responses
#### 200
审批成功
#### 400
审批动作无效
#### 403
无权审批
#### 404
采购申请不存在
#### 500
服务器错误
## POST /api/procurement/{id}/files
> 创建/提交 /api/procurement/{id}/files
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

### Authentication
bearerAuth
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
## GET /api/procurement/requests
> 查询 /api/procurement/requests
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

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
## POST /api/procurement/requests
> 创建/提交 /api/procurement/requests
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

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
## PUT /api/procurement/requests/{id}
> 更新 /api/procurement/requests/{id}
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

### Authentication
bearerAuth
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
## PUT /api/procurement/requests/{id}/approve
> 更新 /api/procurement/requests/{id}/approve
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

### Authentication
bearerAuth
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
## POST /api/procurement/requests/{id}/files
> 创建/提交 /api/procurement/requests/{id}/files
自动从 routes/procurement.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: procurement

### Authentication
bearerAuth
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
## GET /api/quality-control
> 查询 /api/quality-control
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## POST /api/quality-control
> 创建/提交 /api/quality-control
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## DELETE /api/quality-control/{id}
> 删除 /api/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/{id}
> 查询 /api/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## PUT /api/quality-control/{id}
> 更新 /api/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/asset/{assetCode}/history
> 查询 /api/quality-control/asset/{assetCode}/history
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/expiring
> 查询 /api/quality-control/expiring
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/metrology
> 查询 /api/quality-control/metrology
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## POST /api/quality-control/metrology
> 创建/提交 /api/quality-control/metrology
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## DELETE /api/quality-control/metrology/{id}
> 删除 /api/quality-control/metrology/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/metrology/{id}
> 查询 /api/quality-control/metrology/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## PUT /api/quality-control/metrology/{id}
> 更新 /api/quality-control/metrology/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## POST /api/quality-control/metrology/analyze-report
> 创建/提交 /api/quality-control/metrology/analyze-report
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/metrology/expiring
> 查询 /api/quality-control/metrology/expiring
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## POST /api/quality-control/metrology/from-file
> 创建/提交 /api/quality-control/metrology/from-file
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/metrology/statistics
> 查询 /api/quality-control/metrology/statistics
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/metrology/statistics/advanced
> 查询 /api/quality-control/metrology/statistics/advanced
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/quality-control
> 查询 /api/quality-control/quality-control
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## POST /api/quality-control/quality-control
> 创建/提交 /api/quality-control/quality-control
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## DELETE /api/quality-control/quality-control/{id}
> 删除 /api/quality-control/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/quality-control/{id}
> 查询 /api/quality-control/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## PUT /api/quality-control/quality-control/{id}
> 更新 /api/quality-control/quality-control/{id}
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

### Authentication
bearerAuth
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
## GET /api/quality-control/quality-control/expiring
> 查询 /api/quality-control/quality-control/expiring
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/quality-control/statistics
> 查询 /api/quality-control/quality-control/statistics
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/quality-control/statistics/advanced
> 查询 /api/quality-control/quality-control/statistics/advanced
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/reports/comprehensive
> 查询 /api/quality-control/reports/comprehensive
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/reports/metrology
> 查询 /api/quality-control/reports/metrology
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/reports/quality-control
> 查询 /api/quality-control/reports/quality-control
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/statistics
> 查询 /api/quality-control/statistics
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/quality-control/statistics/advanced
> 查询 /api/quality-control/statistics/advanced
自动从 routes/quality-control.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: quality-control

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
## GET /api/ready
> 查询 /api/ready
自动从 routes/health.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: ready

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
## GET /api/risk
> 查询 /api/risk
自动从 modules/asset-risk-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## GET /api/risk/assessments
> 查询 /api/risk/assessments
自动从 modules/asset-risk-management/routes/risk-assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## POST /api/risk/assessments
> 创建/提交 /api/risk/assessments
自动从 modules/asset-risk-management/routes/risk-assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## DELETE /api/risk/assessments/{id}
> 删除 /api/risk/assessments/{id}
自动从 modules/asset-risk-management/routes/risk-assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## PUT /api/risk/assessments/{id}
> 更新 /api/risk/assessments/{id}
自动从 modules/asset-risk-management/routes/risk-assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## GET /api/risk/classification
> 查询 /api/risk/classification
自动从 modules/asset-risk-management/routes/risk-classification.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## POST /api/risk/classification
> 创建/提交 /api/risk/classification
自动从 modules/asset-risk-management/routes/risk-classification.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## DELETE /api/risk/classification/{id}
> 删除 /api/risk/classification/{id}
自动从 modules/asset-risk-management/routes/risk-classification.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## PUT /api/risk/classification/{id}
> 更新 /api/risk/classification/{id}
自动从 modules/asset-risk-management/routes/risk-classification.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## GET /api/risk/classification/stats
> 查询 /api/risk/classification/stats
自动从 modules/asset-risk-management/routes/risk-classification.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## GET /api/risk/controls
> 查询 /api/risk/controls
自动从 modules/asset-risk-management/routes/risk-control.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## POST /api/risk/controls
> 创建/提交 /api/risk/controls
自动从 modules/asset-risk-management/routes/risk-control.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## DELETE /api/risk/controls/{id}
> 删除 /api/risk/controls/{id}
自动从 modules/asset-risk-management/routes/risk-control.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## PUT /api/risk/controls/{id}
> 更新 /api/risk/controls/{id}
自动从 modules/asset-risk-management/routes/risk-control.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

### Authentication
bearerAuth
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
## GET /api/risk/dashboard
> 查询 /api/risk/dashboard
自动从 modules/asset-risk-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## GET /api/risk/status
> 查询 /api/risk/status
自动从 modules/asset-risk-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: risk

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
## GET /api/roles-permissions/menus/definitions
> 查询 /api/roles-permissions/menus/definitions
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## POST /api/roles-permissions/menus/force-update
> 创建/提交 /api/roles-permissions/menus/force-update
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/menus/list
> 查询 /api/roles-permissions/menus/list
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/permissions/definitions
> 查询 /api/roles-permissions/permissions/definitions
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/permissions/list
> 查询 /api/roles-permissions/permissions/list
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/roles
> 查询 /api/roles-permissions/roles
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## POST /api/roles-permissions/roles
> 创建/提交 /api/roles-permissions/roles
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## DELETE /api/roles-permissions/roles/{role}
> 删除 /api/roles-permissions/roles/{role}
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## PUT /api/roles-permissions/roles/{role}
> 更新 /api/roles-permissions/roles/{role}
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## GET /api/roles-permissions/roles/{role}/menus
> 查询 /api/roles-permissions/roles/{role}/menus
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## PUT /api/roles-permissions/roles/{role}/menus
> 更新 /api/roles-permissions/roles/{role}/menus
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## GET /api/roles-permissions/roles/{role}/permissions
> 查询 /api/roles-permissions/roles/{role}/permissions
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## PUT /api/roles-permissions/roles/{role}/permissions
> 更新 /api/roles-permissions/roles/{role}/permissions
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

### Authentication
bearerAuth
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
## PUT /api/roles-permissions/roles/permissions/batch
> 更新 /api/roles-permissions/roles/permissions/batch
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## POST /api/roles-permissions/user/check-permission
> 创建/提交 /api/roles-permissions/user/check-permission
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/user/menus
> 查询 /api/roles-permissions/user/menus
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/roles-permissions/user/permissions
> 查询 /api/roles-permissions/user/permissions
自动从 routes/roles-permissions.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: roles-permissions

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
## GET /api/scrapping
> 查询 /api/scrapping
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

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
## POST /api/scrapping
> 创建/提交 /api/scrapping
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

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
## DELETE /api/scrapping/{id}
> 删除 /api/scrapping/{id}
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## GET /api/scrapping/{id}
> 查询 /api/scrapping/{id}
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## PUT /api/scrapping/{id}
> 更新 /api/scrapping/{id}
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## POST /api/scrapping/{id}/appraise
> 创建/提交 /api/scrapping/{id}/appraise
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## POST /api/scrapping/{id}/approve
> 创建/提交 /api/scrapping/{id}/approve
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## POST /api/scrapping/{id}/complete
> 创建/提交 /api/scrapping/{id}/complete
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## POST /api/scrapping/{id}/dispose
> 创建/提交 /api/scrapping/{id}/dispose
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## POST /api/scrapping/{id}/files
> 创建/提交 /api/scrapping/{id}/files
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

### Authentication
bearerAuth
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
## GET /api/scrapping/statistics/summary
> 查询 /api/scrapping/statistics/summary
自动从 routes/scrapping.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: scrapping

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
## GET /api/staff
> 查询 /api/staff
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## POST /api/staff
> 创建/提交 /api/staff
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## DELETE /api/staff/{id}
> 删除 /api/staff/{id}
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## PUT /api/staff/{id}
> 更新 /api/staff/{id}
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## GET /api/staff/assessments
> 查询 /api/staff/assessments
自动从 modules/staff-qualification/routes/assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## POST /api/staff/assessments
> 创建/提交 /api/staff/assessments
自动从 modules/staff-qualification/routes/assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## DELETE /api/staff/assessments/{id}
> 删除 /api/staff/assessments/{id}
自动从 modules/staff-qualification/routes/assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## PUT /api/staff/assessments/{id}
> 更新 /api/staff/assessments/{id}
自动从 modules/staff-qualification/routes/assessment.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## GET /api/staff/expiring
> 查询 /api/staff/expiring
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## GET /api/staff/qualifications
> 查询 /api/staff/qualifications
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## POST /api/staff/qualifications
> 创建/提交 /api/staff/qualifications
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## DELETE /api/staff/qualifications/{id}
> 删除 /api/staff/qualifications/{id}
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## PUT /api/staff/qualifications/{id}
> 更新 /api/staff/qualifications/{id}
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## GET /api/staff/qualifications/expiring
> 查询 /api/staff/qualifications/expiring
自动从 modules/staff-qualification/routes/staff.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## GET /api/staff/statistics
> 查询 /api/staff/statistics
自动从 modules/staff-qualification/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## GET /api/staff/status
> 查询 /api/staff/status
自动从 modules/staff-qualification/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## GET /api/staff/training
> 查询 /api/staff/training
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## POST /api/staff/training
> 创建/提交 /api/staff/training
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## GET /api/staff/training-records
> 查询 /api/staff/training-records
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## POST /api/staff/training-records
> 创建/提交 /api/staff/training-records
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

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
## DELETE /api/staff/training-records/{id}
> 删除 /api/staff/training-records/{id}
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## PUT /api/staff/training-records/{id}
> 更新 /api/staff/training-records/{id}
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## DELETE /api/staff/training/{id}
> 删除 /api/staff/training/{id}
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## PUT /api/staff/training/{id}
> 更新 /api/staff/training/{id}
自动从 modules/staff-qualification/routes/training.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: staff

### Authentication
bearerAuth
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
## GET /api/system-config
> 查询 /api/system-config
自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: system-config

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
## GET /api/system-config/database
> 查询 /api/system-config/database
自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: system-config

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
## PUT /api/system-config/database
> 更新 /api/system-config/database
自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: system-config

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
## POST /api/system-config/database/test
> 创建/提交 /api/system-config/database/test
自动从 routes/system-config.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: system-config

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
## GET /api/technical-documents
> 获取技术资料列表
获取技术资料列表，支持分页、关键词搜索、分类筛选等
**Tags:** 技术资料管理

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

## POST /api/technical-documents
> 上传技术资料
上传技术资料文件，支持单个资产关联或多个资产关联。新上传的资料默认状态为 pending（待审核）
**Tags:** 技术资料管理

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

## DELETE /api/technical-documents/{id}
> 删除 /api/technical-documents/{id}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/{id}
> 查询 /api/technical-documents/{id}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## PUT /api/technical-documents/{id}
> 更新 /api/technical-documents/{id}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/{id}/file
> 查询 /api/technical-documents/{id}/file
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/{id}/review
> 创建/提交 /api/technical-documents/{id}/review
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/{id}/share
> 创建/提交 /api/technical-documents/{id}/share
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/{id}/shares
> 查询 /api/technical-documents/{id}/shares
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/ai/ask
> 创建/提交 /api/technical-documents/ai/ask
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/batch/ocr
> 创建/提交 /api/technical-documents/ai/batch/ocr
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/batch/summary
> 创建/提交 /api/technical-documents/ai/batch/summary
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/compare
> 创建/提交 /api/technical-documents/ai/compare
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/ai/conversations
> 查询 /api/technical-documents/ai/conversations
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## DELETE /api/technical-documents/ai/conversations/{id}
> 删除 /api/technical-documents/ai/conversations/{id}
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/ai/conversations/{id}
> 查询 /api/technical-documents/ai/conversations/{id}
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/ai/extract
> 创建/提交 /api/technical-documents/ai/extract
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/ocr
> 创建/提交 /api/technical-documents/ai/ocr
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/ai/preview/{id}
> 查询 /api/technical-documents/ai/preview/{id}
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/ai/recommend
> 创建/提交 /api/technical-documents/ai/recommend
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/search
> 创建/提交 /api/technical-documents/ai/search
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/suggest-category
> 创建/提交 /api/technical-documents/ai/suggest-category
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/suggest-tags
> 创建/提交 /api/technical-documents/ai/suggest-tags
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/ai/summary
> 创建/提交 /api/technical-documents/ai/summary
自动从 routes/technical-documents-ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/assets/{assetId}
> 获取资产的技术资料列表
获取指定资产关联的技术资料列表

关联方式包括：
1. 直接关联：technical_documents.asset_id = 资产ID
2. 多资产关联：technical_documents.asset_ids JSON数组包含资产ID
3. 品牌型号匹配：technical_documents.brand = 资产.brand AND technical_documents.model = 资产.model

注意：现在会显示所有状态的资料（包括待审核），但待审核的资料不能下载

**Tags:** 技术资料管理

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetId | integer | yes | 资产ID |

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
| data[].link_type | enum(直接关联, 多资产关联, 品牌型号匹配, 其他) | no | 关联方式 |
| data[].linked_asset.code | string | no | 关联的资产编号 |
| data[].linked_asset_name | string | no | 关联的资产名称 |

#### 400
无效的资产ID
##### application/json
### Response Schema (400 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

#### 404
资产不存在
##### application/json
### Response Schema (404 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## GET /api/technical-documents/assets/{assetIdOrCode}
> 查询 /api/technical-documents/assets/{assetIdOrCode}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |

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
## DELETE /api/technical-documents/assets/{assetIdOrCode}/link/{documentId}
> 删除 /api/technical-documents/assets/{assetIdOrCode}/link/{documentId}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |
| documentId | string | yes |  |

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
## POST /api/technical-documents/assets/{assetIdOrCode}/link/{documentId}
> 创建/提交 /api/technical-documents/assets/{assetIdOrCode}/link/{documentId}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| assetIdOrCode | string | yes |  |
| documentId | string | yes |  |

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
## GET /api/technical-documents/categories
> 查询 /api/technical-documents/categories
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/enhanced/batch/category
> 创建/提交 /api/technical-documents/enhanced/batch/category
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/enhanced/batch/delete
> 创建/提交 /api/technical-documents/enhanced/batch/delete
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/enhanced/categories
> 查询 /api/technical-documents/enhanced/categories
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/enhanced/categories
> 创建/提交 /api/technical-documents/enhanced/categories
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## DELETE /api/technical-documents/enhanced/categories/{id}
> 删除 /api/technical-documents/enhanced/categories/{id}
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## PUT /api/technical-documents/enhanced/categories/{id}
> 更新 /api/technical-documents/enhanced/categories/{id}
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## PUT /api/technical-documents/enhanced/comments/{id}/resolve
> 更新 /api/technical-documents/enhanced/comments/{id}/resolve
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/enhanced/documents/{id}/comments
> 查询 /api/technical-documents/enhanced/documents/{id}/comments
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/enhanced/documents/{id}/comments
> 创建/提交 /api/technical-documents/enhanced/documents/{id}/comments
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## DELETE /api/technical-documents/enhanced/documents/{id}/favorite
> 删除 /api/technical-documents/enhanced/documents/{id}/favorite
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/enhanced/documents/{id}/favorite
> 创建/提交 /api/technical-documents/enhanced/documents/{id}/favorite
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/enhanced/documents/{id}/tags
> 查询 /api/technical-documents/enhanced/documents/{id}/tags
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/enhanced/documents/{id}/tags
> 创建/提交 /api/technical-documents/enhanced/documents/{id}/tags
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/enhanced/documents/{id}/versions
> 查询 /api/technical-documents/enhanced/documents/{id}/versions
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/enhanced/documents/{id}/versions
> 创建/提交 /api/technical-documents/enhanced/documents/{id}/versions
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## POST /api/technical-documents/enhanced/documents/{id}/view
> 创建/提交 /api/technical-documents/enhanced/documents/{id}/view
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/enhanced/my/favorites
> 查询 /api/technical-documents/enhanced/my/favorites
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/enhanced/my/history
> 查询 /api/technical-documents/enhanced/my/history
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/enhanced/statistics
> 查询 /api/technical-documents/enhanced/statistics
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## GET /api/technical-documents/enhanced/tags
> 查询 /api/technical-documents/enhanced/tags
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/enhanced/tags
> 创建/提交 /api/technical-documents/enhanced/tags
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## DELETE /api/technical-documents/enhanced/tags/{id}
> 删除 /api/technical-documents/enhanced/tags/{id}
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/enhanced/templates
> 查询 /api/technical-documents/enhanced/templates
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## POST /api/technical-documents/enhanced/templates
> 创建/提交 /api/technical-documents/enhanced/templates
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## DELETE /api/technical-documents/enhanced/templates/{id}
> 删除 /api/technical-documents/enhanced/templates/{id}
自动从 routes/technical-documents-enhanced.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
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
## GET /api/technical-documents/pending
> 查询 /api/technical-documents/pending
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

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
## DELETE /api/technical-documents/shares/{shareId}
> 删除 /api/technical-documents/shares/{shareId}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| shareId | string | yes |  |

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
## GET /api/technical-documents/upload/{token}
> 查询 /api/technical-documents/upload/{token}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | yes |  |

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
## POST /api/technical-documents/upload/{token}
> 创建/提交 /api/technical-documents/upload/{token}
自动从 routes/technical-documents.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: technical-documents

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | yes |  |

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
## GET /api/temp-assets
> 查询 /api/temp-assets
自动从 routes/temp-assets.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: temp-assets

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
## POST /api/temp-assets
> 创建/提交 /api/temp-assets
自动从 routes/temp-assets.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: temp-assets

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
## DELETE /api/temp-assets/{id}
> 删除 /api/temp-assets/{id}
自动从 routes/temp-assets.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: temp-assets

### Authentication
bearerAuth
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
## GET /api/temp-assets/{id}
> 查询 /api/temp-assets/{id}
自动从 routes/temp-assets.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: temp-assets

### Authentication
bearerAuth
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
## PUT /api/temp-assets/{id}
> 更新 /api/temp-assets/{id}
自动从 routes/temp-assets.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: temp-assets

### Authentication
bearerAuth
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
## GET /api/tenant-module-config/logs
> 获取配置变更日志
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenantId | string | no | 企业空间ID |
| moduleId | string | no | 模块ID |
| startDate | string | no | 开始日期 |
| endDate | string | no | 结束日期 |
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
成功获取配置变更日志
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| total | integer | no |  |
| records | array&lt;object&gt; | no |  |
| records[].id | string | no |  |
| records[].tenant_id | string | no |  |
| records[].tenant_name | string | no |  |
| records[].module_id | string | no |  |
| records[].module_name | string | no |  |
| records[].action | string | no |  |
| records[].old_value | object | no |  |
| records[].new_value | object | no |  |
| records[].operator_id | string | no |  |
| records[].operator_name | string | no |  |
| records[].created_at | string | no |  |

## GET /api/tenant-module-config/modules
> 获取所有可用模块
**Tags:** TenantModuleConfig

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
成功获取可用模块
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].id | string | no |  |
| items[].name | string | no |  |
| items[].version | string | no |  |
| items[].category | string | no |  |
| items[].type | string | no |  |
| items[].description | string | no |  |

## POST /api/tenant-module-config/modules/{moduleId}/check-dependencies
> 检查模块依赖关系
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes | 模块ID |

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
| action | enum(enable, disable) | no | 操作类型 |

### Responses
#### 200
成功检查模块依赖关系
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| valid | boolean | no |  |
| message | string | no |  |

## GET /api/tenant-module-config/modules/{moduleId}/dependencies
> 获取指定模块的依赖关系
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes | 模块ID |

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
成功获取模块依赖关系
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].dependency_id | string | no |  |
| items[].dependency_type | string | no |  |

## GET /api/tenant-module-config/modules/{moduleId}/menus
> 获取指定模块的菜单列表
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes | 模块ID |

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
成功获取模块菜单列表
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].menu_key | string | no |  |
| items[].menu_label | string | no |  |
| items[].parent_key | string | no |  |
| items[].icon | string | no |  |
| items[].order_index | integer | no |  |

## GET /api/tenant-module-config/tenants
> 获取企业空间列表
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| search | string | no | 按企业名称或ID搜索 |
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
成功获取企业空间列表
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| total | integer | no |  |
| records | array&lt;object&gt; | no |  |
| records[].id | string | no |  |
| records[].name | string | no |  |
| records[].code | string | no |  |
| records[].status | string | no |  |

## GET /api/tenant-module-config/tenants/{tenantId}/modules
> 获取指定企业空间的模块配置
**Tags:** TenantModuleConfig

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
无
### Responses
#### 200
成功获取模块配置
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].module_id | string | no |  |
| items[].module_name | string | no |  |
| items[].version | string | no |  |
| items[].category | string | no |  |
| items[].type | string | no |  |
| items[].enabled | boolean | no |  |
| items[].config | object | no |  |

## PUT /api/tenant-module-config/tenants/{tenantId}/modules
> 更新企业空间的模块配置
**Tags:** TenantModuleConfig

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

## GET /api/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus
> 获取指定企业空间的模块菜单配置
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenantId | string | yes | 企业空间ID |
| moduleId | string | yes | 模块ID |

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
成功获取模块菜单配置
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| items | array&lt;object&gt; | no |  |
| items[].menu_key | string | no |  |
| items[].menu_label | string | no |  |
| items[].parent_key | string | no |  |
| items[].icon | string | no |  |
| items[].order_index | integer | no |  |
| items[].is_enabled | boolean | no |  |

## PUT /api/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus
> 更新指定企业空间的模块菜单配置
**Tags:** TenantModuleConfig

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenantId | string | yes | 企业空间ID |
| moduleId | string | yes | 模块ID |

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
| items[].menu_key | string | no |  |
| items[].is_enabled | boolean | no |  |

### Responses
#### 200
成功更新模块菜单配置
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |

## GET /api/tenants
> 查询 /api/tenants
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

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
## POST /api/tenants
> 创建/提交 /api/tenants
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

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
## DELETE /api/tenants/{id}(\\d+)
> 删除 /api/tenants/{id}(\\d+)
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

### Authentication
bearerAuth
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
## GET /api/tenants/{id}(\\d+)
> 查询 /api/tenants/{id}(\\d+)
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

### Authentication
bearerAuth
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
## PUT /api/tenants/{id}(\\d+)
> 更新 /api/tenants/{id}(\\d+)
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

### Authentication
bearerAuth
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
## GET /api/tenants/current/info
> 查询 /api/tenants/current/info
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

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
## POST /api/tenants/verify
> 创建/提交 /api/tenants/verify
自动从 routes/tenants.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: tenants

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
## GET /api/transfer
> 查询 /api/transfer
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

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
## POST /api/transfer
> 创建/提交 /api/transfer
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

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
## DELETE /api/transfer/{id}
> 删除 /api/transfer/{id}
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

### Authentication
bearerAuth
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
## GET /api/transfer/{id}
> 查询 /api/transfer/{id}
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

### Authentication
bearerAuth
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
## PUT /api/transfer/{id}/approve
> 更新 /api/transfer/{id}/approve
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

### Authentication
bearerAuth
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
## PUT /api/transfer/{id}/complete
> 更新 /api/transfer/{id}/complete
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

### Authentication
bearerAuth
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
## GET /api/transfer/statistics
> 查询 /api/transfer/statistics
自动从 routes/transfer.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: transfer

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
## GET /api/uptime
> 查询 /api/uptime
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## POST /api/uptime
> 创建/提交 /api/uptime
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## DELETE /api/uptime/{id}
> 删除 /api/uptime/{id}
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## PUT /api/uptime/{id}
> 更新 /api/uptime/{id}
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## GET /api/uptime/batch-operation-logs
> 查询 /api/uptime/batch-operation-logs
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## POST /api/uptime/batch-operation-logs
> 创建/提交 /api/uptime/batch-operation-logs
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## DELETE /api/uptime/batch-operation-logs/{id}
> 删除 /api/uptime/batch-operation-logs/{id}
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## PUT /api/uptime/batch-operation-logs/{id}
> 更新 /api/uptime/batch-operation-logs/{id}
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## POST /api/uptime/calculate
> 创建/提交 /api/uptime/calculate
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/uptime/config
> 查询 /api/uptime/config
自动从 modules/uptime-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/uptime/dashboard
> 查询 /api/uptime/dashboard
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/uptime/operation-logs
> 查询 /api/uptime/operation-logs
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## POST /api/uptime/operation-logs
> 创建/提交 /api/uptime/operation-logs
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## DELETE /api/uptime/operation-logs/{id}
> 删除 /api/uptime/operation-logs/{id}
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## PUT /api/uptime/operation-logs/{id}
> 更新 /api/uptime/operation-logs/{id}
自动从 modules/uptime-management/routes/operation-log.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## GET /api/uptime/statistics
> 查询 /api/uptime/statistics
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## POST /api/uptime/statistics
> 创建/提交 /api/uptime/statistics
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## DELETE /api/uptime/statistics/{id}
> 删除 /api/uptime/statistics/{id}
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## PUT /api/uptime/statistics/{id}
> 更新 /api/uptime/statistics/{id}
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

### Authentication
bearerAuth
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
## POST /api/uptime/statistics/calculate
> 创建/提交 /api/uptime/statistics/calculate
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/uptime/statistics/dashboard
> 查询 /api/uptime/statistics/dashboard
自动从 modules/uptime-management/routes/uptime.routes.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/uptime/status
> 查询 /api/uptime/status
自动从 modules/uptime-management/routes/index.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: uptime

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
## GET /api/users
> 查询 /api/users
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## POST /api/users
> 创建/提交 /api/users
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## DELETE /api/users/{id}
> 删除 /api/users/{id}
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## GET /api/users/{id}
> 查询 /api/users/{id}
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## PUT /api/users/{id}
> 更新 /api/users/{id}
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## PUT /api/users/{id}/approve
> 更新 /api/users/{id}/approve
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## PUT /api/users/{id}/change-password
> 更新 /api/users/{id}/change-password
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## GET /api/users/{id}/roles
> 查询 /api/users/{id}/roles
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## POST /api/users/{id}/roles
> 创建/提交 /api/users/{id}/roles
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## DELETE /api/users/{id}/roles/{tenantId}
> 删除 /api/users/{id}/roles/{tenantId}
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | yes |  |
| tenantId | string | yes |  |

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
## GET /api/users/export
> 查询 /api/users/export
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## POST /api/users/join-enterprise
> 创建/提交 /api/users/join-enterprise
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## POST /api/users/login
> 用户登录
用户登录接口，验证用户名和密码，返回 JWT token
**Tags:** 用户管理

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
| username | string | yes | 用户名 |
| password | string | yes | 密码 |

### Responses
#### 200
登录成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | object | no |  |
| data.user | object | no |  |
| data.user.id | integer | no |  |
| data.user.username | string | no |  |
| data.user.real_name | string | no |  |
| data.user.role | enum(system_admin, asset_admin, department_admin, user) | no |  |
| data.user.department | string | no |  |
| data.token | string | no |  |

#### 400
请求参数错误
##### application/json
### Response Schema (400 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

#### 401
用户名或密码错误，或用户已被禁用
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## GET /api/users/pending
> 查询 /api/users/pending
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## GET /api/users/profile
> 查询 /api/users/profile
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## POST /api/users/refresh-token
> 刷新令牌
使用当前有效的令牌刷新获取新的令牌
**Tags:** 用户管理

### Authentication
BearerAuth
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
令牌刷新成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| data | object | no |  |
| data.token | string | no |  |
| data.tokenExpiry | integer | no |  |

#### 401
无效的认证令牌
##### application/json
### Response Schema (401 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| success | boolean | no |  |
| message | string | no |  |
| error | string | no |  |

## POST /api/users/register
> 创建/提交 /api/users/register
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## PUT /api/users/role-requests/{id}/approve
> 更新 /api/users/role-requests/{id}/approve
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

### Authentication
bearerAuth
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
## GET /api/users/role-requests/pending
> 查询 /api/users/role-requests/pending
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## GET /api/users/roles
> 查询 /api/users/roles
自动从 routes/users.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: users

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
## GET /api/workflow
> 工作流API信息
**Tags:** 工作流

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
API信息
## GET /api/workflow/default
> 获取默认工作流ID
**Tags:** 工作流

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
## GET /api/workflow/states
> 获取工作流状态列表
**Tags:** 工作流

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
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].state_code | string | no |  |
| data[].state_name | string | no |  |
| data[].color | string | no |  |
| data[].sort_order | integer | no |  |
| data[].is_terminal | boolean | no |  |

#### 500
服务器错误
## POST /api/workflow/transition/{assetId}
> 执行状态迁移
对资产执行工作流状态迁移
**Tags:** 工作流

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
## GET /api/workflow/transitions
> 获取工作流迁移规则
**Tags:** 工作流

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| from_state | string | no | 来源状态 |

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
| data | array&lt;object&gt; | no |  |
| data[].id | integer | no |  |
| data[].transition_name | string | no |  |
| data[].from_state | string | no |  |
| data[].from_state_name | string | no |  |
| data[].to_state | string | no |  |
| data[].to_state_name | string | no |  |
| data[].require_reason | boolean | no |  |
| data[].is_active | boolean | no |  |

#### 500
服务器错误
## GET /assets
> 获取资产列表
**Tags:** 库存管理

### Authentication
bearerAuth
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
## POST /assets
> 新增资产
**Tags:** 库存管理

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
## DELETE /assets/{id}
> 删除资产
**Tags:** 库存管理

### Authentication
bearerAuth
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
## GET /assets/{id}
> 获取资产详情
**Tags:** 库存管理

### Authentication
bearerAuth
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
## PUT /assets/{id}
> 更新资产
**Tags:** 库存管理

### Authentication
bearerAuth
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
## GET /assets/export
> 导出资产Excel
**Tags:** 库存管理

### Authentication
bearerAuth
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
Excel导出文件
##### application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
### Response Schema (200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
无
## POST /assets/import
> 导入资产Excel
**Tags:** 库存管理

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
| file | string | yes |  |

### Responses
#### 200
导入完成
##### application/json
### Response Schema (200 application/json)
无
#### 400
文件或格式错误
##### application/json
### Response Schema (400 application/json)
无
## GET /assets/import-template
> 下载资产导入模板
**Tags:** 库存管理

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
Excel模板文件
##### application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
### Response Schema (200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
无
## POST /chat/chat/completions
> 创建/提交 /chat/chat/completions
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## POST /chat/completions
> 创建/提交 /chat/completions
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## GET /chat/config
> 查询 /chat/config
自动从 routes/ai.js 的 Express 路由声明生成的基础接口文档。
**Tags:** 自动发现: chat

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
## GET /health
> 服务健康检查
检查后端服务运行状态与时间戳信息。
**Tags:** 系统管理

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
服务可用
##### application/json
### Response Schema (200 application/json)
无
## GET /maintenance/logs
> 获取维护日志列表
**Tags:** 维修维护

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
无
## POST /maintenance/logs
> 创建维护日志
**Tags:** 维修维护

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
## DELETE /maintenance/logs/{id}
> 删除维护日志
**Tags:** 维修维护

### Authentication
bearerAuth
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
删除成功
##### application/json
### Response Schema (200 application/json)
无
## GET /maintenance/logs/{id}
> 获取维护日志详情
**Tags:** 维修维护

### Authentication
bearerAuth
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
## PUT /maintenance/logs/{id}
> 更新维护日志
**Tags:** 维修维护

### Authentication
bearerAuth
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
无
### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## GET /maintenance/requests
> 获取维修申请列表
**Tags:** 维修维护

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no |  |
| pageSize | integer | no |  |
| status | string | no |  |

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
## POST /maintenance/requests
> 创建维修申请
**Tags:** 维修维护

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
| asset_code | string | yes |  |
| issue_description | string | yes |  |
| priority | string | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
## DELETE /maintenance/requests/{id}
> 删除维修申请
**Tags:** 维修维护

### Authentication
bearerAuth
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
删除成功
##### application/json
### Response Schema (200 application/json)
无
## GET /maintenance/requests/{id}
> 获取维修申请详情
**Tags:** 维修维护

### Authentication
bearerAuth
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
## PUT /maintenance/requests/{id}
> 更新维修申请
**Tags:** 维修维护

### Authentication
bearerAuth
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
无
### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## POST /maintenance/requests/{id}/approve
> 审批维修申请
**Tags:** 维修维护

### Authentication
bearerAuth
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
## GET /maintenance/statistics
> 获取维护统计
**Tags:** 维修维护

### Authentication
bearerAuth
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
## GET /module-configs/{moduleId}
> 获取单模块租户配置
**Tags:** 模块管理

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |

### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenant_id | integer | no |  |

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
## PUT /module-configs/{moduleId}
> 更新单模块租户配置
**Tags:** 模块管理

### Authentication
bearerAuth
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
## GET /module-configs/{moduleId}/menus
> 获取模块菜单启用状态
**Tags:** 模块管理

### Authentication
bearerAuth
### Path Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| moduleId | string | yes |  |

### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenant_id | integer | no |  |

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
## PUT /module-configs/{moduleId}/menus
> 批量更新模块菜单启用状态
**Tags:** 模块管理

### Authentication
bearerAuth
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
| menus | array&lt;object&gt; | yes |  |
| menus[].menu_key | string | no |  |
| menus[].is_enabled | boolean | no |  |

### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## POST /module-configs/disable
> 停用模块
为租户停用模块，并校验是否被其他已启用模块依赖。
**Tags:** 模块管理

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
| module_id | string | yes |  |
| tenant_id | integer | no |  |

### Responses
#### 200
停用成功
##### application/json
### Response Schema (200 application/json)
无
#### 400
被依赖，无法停用
##### application/json
### Response Schema (400 application/json)
无
## POST /module-configs/enable
> 启用模块
为租户启用指定模块，并自动校验 required 依赖。
**Tags:** 模块管理

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
| module_id | string | yes |  |
| tenant_id | integer | no |  |
| config | object | no |  |

### Responses
#### 200
启用成功
##### application/json
### Response Schema (200 application/json)
无
#### 400
参数错误或依赖未满足
##### application/json
### Response Schema (400 application/json)
无
## GET /module-configs/list
> 获取租户模块配置列表
返回当前租户的模块状态、配置、分类、菜单域等信息。
**Tags:** 模块管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tenant_id | integer | no | 超级管理员可指定租户ID |
| category | string | no | 按分类过滤（如 资产生命周期 / 分析与智能） |

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
| data | array&lt;object&gt; | no |  |
| data[] | object | no | Missing reference: #/components/schemas/ModuleConfigListItem |

#### 500
查询失败
##### application/json
### Response Schema (500 application/json)
无
## GET /modules
> 获取模块清单
获取系统模块列表（仅超级管理员/系统管理员）。
**Tags:** 模块管理

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
| data | array&lt;object&gt; | no |  |
| data[].id | string | no |  |
| data[].name | string | no |  |
| data[].version | string | no |  |

## GET /modules/{moduleId}/dependencies
> 获取模块依赖
获取指定模块的依赖关系，可用于启停前依赖校验。
**Tags:** 模块管理

### Authentication
bearerAuth
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
无
### Responses
#### 200
成功
##### application/json
### Response Schema (200 application/json)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| data | array&lt;object&gt; | no |  |
| data[] | object | no | Missing reference: #/components/schemas/ModuleDependency |

#### 404
模块不存在
##### application/json
### Response Schema (404 application/json)
无
## GET /procurement/requests
> 获取采购单列表
**Tags:** 采购管理

### Authentication
bearerAuth
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
## POST /procurement/requests
> 创建采购单
**Tags:** 采购管理

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
## PUT /procurement/requests/{id}
> 更新采购单
**Tags:** 采购管理

### Authentication
bearerAuth
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
无
### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## PUT /procurement/requests/{id}/approve
> 审批采购单
**Tags:** 采购管理

### Authentication
bearerAuth
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
## PUT /procurement/requests/{id}/execute
> 更新采购执行状态
**Tags:** 采购管理

### Authentication
bearerAuth
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
| completed | boolean | no |  |
| result | string | no |  |

### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## GET /procurement/requests/{id}/files
> 获取采购单附件列表
**Tags:** 采购管理

### Authentication
bearerAuth
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
## POST /procurement/requests/{id}/files
> 上传采购单附件
**Tags:** 采购管理

### Authentication
bearerAuth
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
#### multipart/form-data
### Schema (multipart/form-data)
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| file | string | yes |  |
| file_type | string | no |  |

### Responses
#### 200
上传成功
##### application/json
### Response Schema (200 application/json)
无
## GET /procurement/stats
> 获取采购统计
**Tags:** 采购管理

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
无
## GET /quality-control/metrology
> 获取计量记录列表
**Tags:** 质量管理

### Authentication
bearerAuth
### Path Parameters
无
### Query Parameters
| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | no |  |
| pageSize | integer | no |  |
| asset_code | string | no |  |

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
## POST /quality-control/metrology
> 创建计量记录
**Tags:** 质量管理

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
| asset_code | string | yes |  |
| metrology_type | string | yes |  |
| metrology_date | string | yes |  |
| result | string | no |  |

### Responses
#### 200
创建成功
##### application/json
### Response Schema (200 application/json)
无
## DELETE /quality-control/metrology/{id}
> 删除计量记录
**Tags:** 质量管理

### Authentication
bearerAuth
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
删除成功
##### application/json
### Response Schema (200 application/json)
无
## GET /quality-control/metrology/{id}
> 获取计量记录详情
**Tags:** 质量管理

### Authentication
bearerAuth
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
## PUT /quality-control/metrology/{id}
> 更新计量记录
**Tags:** 质量管理

### Authentication
bearerAuth
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
无
### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## GET /quality-control/quality-control
> 获取质量控制记录列表
**Tags:** 质量管理

### Authentication
bearerAuth
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
## POST /quality-control/quality-control
> 创建质量控制记录
**Tags:** 质量管理

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
## DELETE /quality-control/quality-control/{id}
> 删除质量控制记录
**Tags:** 质量管理

### Authentication
bearerAuth
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
删除成功
##### application/json
### Response Schema (200 application/json)
无
## GET /quality-control/quality-control/{id}
> 获取质量控制记录详情
**Tags:** 质量管理

### Authentication
bearerAuth
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
## PUT /quality-control/quality-control/{id}
> 更新质量控制记录
**Tags:** 质量管理

### Authentication
bearerAuth
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
无
### Responses
#### 200
更新成功
##### application/json
### Response Schema (200 application/json)
无
## GET /quality-control/quality-control/statistics
> 获取质量控制统计
**Tags:** 质量管理

### Authentication
bearerAuth
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
## GET /roles-permissions/user/menus
> 获取当前用户菜单权限
返回当前登录用户可见菜单的 key 列表，用于前端动态菜单渲染。
**Tags:** 系统管理

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
| data | array&lt;string&gt; | no |  |
| data[] | string | no |  |

