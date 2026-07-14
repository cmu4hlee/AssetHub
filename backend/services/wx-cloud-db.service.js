/**
 * 微信小程序云数据库 HTTP API 服务
 * 通过微信云开发 HTTP API 访问云数据库
 */

const axios = require('axios');
const logger = require('../config/logger');

// 微信 API 基础地址
const WX_API_BASE = 'https://api.weixin.qq.com';

class WxCloudDBService {
  constructor() {
    this.appId = process.env.WX_CLOUD_APP_ID || '';
    this.appSecret = process.env.WX_CLOUD_APP_SECRET || '';
    this.envId = process.env.WX_CLOUD_ENV_ID || '';

    // access_token 缓存
    this._accessToken = '';
    this._tokenExpiresAt = 0;

    // HTTP 客户端
    this._http = axios.create({
      timeout: 30000,
    });
  }

  /**
   * 检查配置是否完整
   */
  isConfigured() {
    return !!(this.appId && this.appSecret && this.envId);
  }

  /**
   * 获取 access_token（自动缓存和刷新）
   */
  async getAccessToken() {
    // 缓存未过期，直接返回
    if (this._accessToken && Date.now() < this._tokenExpiresAt) {
      return this._accessToken;
    }

    if (!this.appId || !this.appSecret) {
      throw new Error('微信云开发未配置：缺少 WX_CLOUD_APP_ID 或 WX_CLOUD_APP_SECRET');
    }

    try {
      const url = `${WX_API_BASE}/cgi-bin/token`;
      const res = await this._http.get(url, {
        params: {
          grant_type: 'client_credential',
          appid: this.appId,
          secret: this.appSecret,
        },
      });

      const data = res.data;
      if (data.errcode) {
        throw new Error(`获取 access_token 失败: [${data.errcode}] ${data.errmsg}`);
      }

      this._accessToken = data.access_token;
      // 提前 5 分钟过期，避免边界情况
      this._tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

      logger.info('微信云开发 access_token 刷新成功');
      return this._accessToken;
    } catch (error) {
      if (error.response) {
        throw new Error(`微信 API 请求失败: ${error.response.status} ${error.response.statusText}`);
      }
      throw error;
    }
  }

  /**
   * 通用请求方法
   */
  async _request(apiPath, body) {
    const accessToken = await this.getAccessToken();
    const url = `${WX_API_BASE}${apiPath}?access_token=${accessToken}`;

    const res = await this._http.post(url, body);
    const data = res.data;

    if (data.errcode && data.errcode !== 0) {
      // access_token 过期，清除缓存后重试一次
      if (data.errcode === 42001 || data.errcode === 40001) {
        this._accessToken = '';
        this._tokenExpiresAt = 0;
        const newToken = await this.getAccessToken();
        const retryUrl = `${WX_API_BASE}${apiPath}?access_token=${newToken}`;
        const retryRes = await this._http.post(retryUrl, body);
        const retryData = retryRes.data;
        if (retryData.errcode && retryData.errcode !== 0) {
          throw new Error(`微信云数据库请求失败: [${retryData.errcode}] ${retryData.errmsg}`);
        }
        return retryData;
      }
      throw new Error(`微信云数据库请求失败: [${data.errcode}] ${data.errmsg}`);
    }

    return data;
  }

  /**
   * 查询记录
   * @param {string} collection - 集合名称
   * @param {object} query - 查询条件
   * @param {object} options - 可选参数 { limit, offset, order }
   */
  async query(collection, query = {}, options = {}) {
    const body = {
      env: this.envId,
      query: `db.collection("${collection}").where(${JSON.stringify(query)})${this._buildOptions(options)}.get()`,
    };

    const data = await this._request('/tcb/databasequery', body);

    // 解析返回数据
    const records = (data.data || []).map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });

    return {
      records,
      total: data.pager ? data.pager.Total : records.length,
      limit: data.pager ? data.pager.Limit : options.limit || 20,
      offset: data.pager ? data.pager.Offset : options.offset || 0,
    };
  }

  /**
   * 新增记录
   * @param {string} collection - 集合名称
   * @param {object} data - 记录数据
   */
  async add(collection, data) {
    const body = {
      env: this.envId,
      query: `db.collection("${collection}").add({data: ${JSON.stringify(data)}})`,
    };

    const result = await this._request('/tcb/databaseadd', body);
    return {
      id: result.id_list ? result.id_list[0] : null,
      ids: result.id_list || [],
    };
  }

  /**
   * 更新记录
   * @param {string} collection - 集合名称
   * @param {string} docId - 记录ID
   * @param {object} data - 更新数据
   */
  async update(collection, docId, data) {
    const body = {
      env: this.envId,
      query: `db.collection("${collection}").doc("${docId}").update({data: ${JSON.stringify(data)}})`,
    };

    const result = await this._request('/tcb/databaseupdate', body);
    return {
      updated: result.updated || 0,
    };
  }

  /**
   * 删除记录
   * @param {string} collection - 集合名称
   * @param {string} docId - 记录ID
   */
  async remove(collection, docId) {
    const body = {
      env: this.envId,
      query: `db.collection("${collection}").doc("${docId}").remove()`,
    };

    const result = await this._request('/tcb/databasedelete', body);
    return {
      deleted: result.deleted || 0,
    };
  }

  /**
   * 聚合查询
   * @param {string} collection - 集合名称
   * @param {string} aggregateQuery - 聚合查询语句
   */
  async aggregate(collection, aggregateQuery) {
    const body = {
      env: this.envId,
      query: `db.collection("${collection}").aggregate()${aggregateQuery}.end()`,
    };

    const data = await this._request('/tcb/databaseaggregate', body);

    const records = (data.data || []).map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });

    return { records };
  }

  /**
   * 统计记录数
   * @param {string} collection - 集合名称
   * @param {object} query - 查询条件
   */
  async count(collection, query = {}) {
    const result = await this.aggregate(collection, `.match(${JSON.stringify(query)}).count("total")`);
    if (result.records.length > 0) {
      return { total: result.records[0].total || 0 };
    }
    return { total: 0 };
  }

  /**
   * 获取集合列表
   */
  async listCollections() {
    const body = {
      env: this.envId,
    };

    const data = await this._request('/tcb/databaselistcollections', body);
    return {
      collections: data.collections || [],
    };
  }

  /**
   * 构建查询选项字符串
   */
  _buildOptions(options) {
    let str = '';
    if (options.order) {
      const { field, direction = 'asc' } = options.order;
      str += `.orderBy("${field}", "${direction}")`;
    }
    if (options.offset !== undefined) {
      str += `.skip(${options.offset})`;
    }
    if (options.limit !== undefined) {
      str += `.limit(${options.limit})`;
    }
    return str;
  }
}

// 单例
const wxCloudDBService = new WxCloudDBService();

module.exports = wxCloudDBService;
