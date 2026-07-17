/**
 * Acceptance 验收管理 zod schemas
 *
 * 用法:
 *   const { CreateApplicationSchema } = require('../../../schemas/acceptance.schemas');
 *   router.post('/applications', validateBody(CreateApplicationSchema), controller.create);
 *
 * 原则:
 * 1. 只验证前端已传字段, 不强制全部 (后端有默认值 + 可空字段)
 * 2. 错误返回 422, body 形如 { errors: [{ path, message, code }] }
 * 3. 转换: trim / default / 日期解析
 */

const { z } = require('zod');

// 优先级 (匹配现有 service 允许值: 中/低/高 + 数字)
const PrioritySchema = z.union([
  z.literal('低'),
  z.literal('中'),
  z.literal('高'),
  z.literal('紧急'),
  z.literal('1'),
  z.literal('2'),
  z.literal('3'),
  z.literal('4'),
]).default('中');

// ISO 日期或 YYYY-MM-DD
const DateStringSchema = z
  .string()
  .refine(s => !isNaN(Date.parse(s)), { message: '日期格式无效 (需要 YYYY-MM-DD 或 ISO8601)' })
  .transform(s => new Date(s).toISOString().slice(0, 10));

// 创建验收申请
const CreateApplicationSchema = z
  .object({
    title: z.string().min(1, '标题不能为空').max(200, '标题最多 200 字符').trim(),
    asset_code: z.string().max(100).trim().optional().nullable(),
    asset_name: z.string().max(200).trim().optional().nullable(),
    supplier: z.string().max(200).trim().optional().nullable(),
    planned_acceptance_date: DateStringSchema.optional().nullable(),
    department: z.string().max(50).trim().optional().nullable(),
    functional_department: z.string().max(50).trim().optional().nullable(),
    priority: PrioritySchema,
    description: z.string().max(2000).trim().optional().nullable(),
  })
  .strict();

// 更新验收申请 (部分字段)
const UpdateApplicationSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    asset_code: z.string().max(100).trim().optional().nullable(),
    asset_name: z.string().max(200).trim().optional().nullable(),
    supplier: z.string().max(200).trim().optional().nullable(),
    planned_acceptance_date: DateStringSchema.optional().nullable(),
    priority: PrioritySchema.optional(),
    description: z.string().max(2000).trim().optional().nullable(),
  })
  .strict();

// 列表查询参数
const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  status: z
    .enum(['草稿', '已提交', '审批中', '已通过', '已驳回', '已撤回', '已完成'])
    .optional(),
  priority: z.enum(['低', '中', '高', '紧急']).optional(),
  keyword: z.string().max(100).trim().optional(),
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.optional(),
});

// ID 路径参数
const IdParamSchema = z.object({
  id: z.coerce.number().int().min(1, 'id 必须为正整数'),
});

module.exports = {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  ListQuerySchema,
  IdParamSchema,
};
