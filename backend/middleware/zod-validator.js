/**
 * Zod 验证中间件
 *
 * 用法:
 *   const { z } = require('zod');
 *   const { validateBody, validateQuery, validateParams } = require('../middleware/zod-validator');
 *
 *   const CreateWorkOrderSchema = z.object({
 *     work_order_no: z.string().min(1).max(50),
 *     asset_code: z.string().min(1).max(100),
 *     priority: z.enum(['1','2','3','4']),
 *   });
 *
 *   router.post('/',
 *     authenticate,
 *     validateBody(CreateWorkOrderSchema),
 *     workorderController.create
 *   );
 *
 * 错误: 422 Unprocessable Entity, body 形如:
 *   { success: false, message: '请求参数验证失败', errors: [{ path: 'body.priority', message: 'Invalid enum value' }] }
 */

const { ZodError } = require('zod');

function formatZodIssues(zodError) {
  return zodError.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

function makeValidator(source, schema) {
  if (!schema) {
    throw new Error(`validate${source} 需要 zod schema`);
  }
  return (req, res, next) => {
    const data = req[source];
    const result = schema.safeParse(data);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: `请求${sourceCN(source)}验证失败`,
        errors: formatZodIssues(result.error),
      });
    }
    // 把验证+转换后的值覆盖回 req (可选, 默认覆盖)
    req[source] = result.data;
    next();
  };
}

function sourceCN(s) {
  return { body: '参数', query: '查询', params: '路径' }[s] || s;
}

const validateBody = schema => makeValidator('body', schema);
const validateQuery = schema => makeValidator('query', schema);
const validateParams = schema => makeValidator('params', schema);

/**
 * 通用: 多源验证 (body + query + params 一次定义)
 * @param {Object} schemas  { body?, query?, params? }
 */
const validate = (schemas = {}) => (req, res, next) => {
  const errors = [];
  const sources = ['body', 'query', 'params'];
  for (const src of sources) {
    if (!schemas[src]) continue;
    const result = schemas[src].safeParse(req[src]);
    if (result.success) {
      req[src] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          path: `${src}.${issue.path.join('.')}`,
          message: issue.message,
          code: issue.code,
        });
      }
    }
  }
  if (errors.length > 0) {
    return res.status(422).json({
      success: false,
      message: '请求参数验证失败',
      errors,
    });
  }
  next();
};

module.exports = {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  formatZodIssues,
  // re-export ZodError 方便调用方 import
  ZodError,
};
