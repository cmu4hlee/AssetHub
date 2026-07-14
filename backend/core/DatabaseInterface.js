const dbHelper = require('../utils/db-helper');
const logger = require('../config/logger');

class DatabaseInterface {
  constructor() {
    this._db = null;
  }

  async query(sql, params, options = {}) {
    return dbHelper.query(sql, params, options);
  }

  async execute(sql, params, options = {}) {
    return dbHelper.execute(sql, params, options);
  }

  async transaction(callback, options = {}) {
    return dbHelper.transaction(callback, options);
  }

  async batchInsert(table, columns, values, options = {}) {
    return dbHelper.batchInsert(table, columns, values, options);
  }

  async paginate(sql, params, options = {}) {
    return dbHelper.paginate(sql, params, options);
  }

  async cachedQuery(cacheKey, sql, params, options = {}) {
    return dbHelper.cachedQuery(cacheKey, sql, params, options);
  }

  async getConnection() {
    const db = require('../config/database');
    return db.getConnection();
  }

  async findOne(sql, params) {
    const [rows] = await this.query(sql, params);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async findMany(sql, params) {
    const [rows] = await this.query(sql, params);
    return rows || [];
  }

  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.execute(sql, values);
  }

  async update(table, data, whereClause, whereParams) {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), ...whereParams];
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    return this.execute(sql, values);
  }

  async deleteFrom(table, whereClause, whereParams) {
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    return this.execute(sql, whereParams);
  }

  async count(table, whereClause = '', whereParams = []) {
    const sql = `SELECT COUNT(*) as total FROM ${table}${whereClause ? ` WHERE ${  whereClause}` : ''}`;
    const result = await this.findOne(sql, whereParams);
    return result ? result.total : 0;
  }

  async exists(table, whereClause, whereParams) {
    const count = await this.count(table, whereClause, whereParams);
    return count > 0;
  }
}

let instance = null;

function getInstance() {
  if (!instance) {
    instance = new DatabaseInterface();
  }
  return instance;
}

const getDatabase = getInstance;

module.exports = { DatabaseInterface, getInstance, getDatabase };
