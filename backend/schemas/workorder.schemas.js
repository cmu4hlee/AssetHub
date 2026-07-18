/**
 * 工单管理 zod schemas
 *
 * 接 P1 输入验证: 工单创建/派工/完成/评价 4 个核心 action
 */

const { z } = require('zod');

// 通用: ID 路径参数
const IdParamSchema = z.object({
  id: z.coerce.number().int().min(1, 'id 必须为正整数'),
});

// ISO 日期或 YYYY-MM-DD, 允许 null
const DateStringSchema = z
  .string()
  .refine(s => !isNaN(Date.parse(s)), { message: '日期格式无效' })
  .transform(s => new Date(s).toISOString().slice(0, 10));

// 状态枚举 (匹配数据库 enum)
const StatusSchema = z.enum([
  'pending',
  'assigned',
  'in_progress',
  'pending_acceptance',
  'pending_review',
  'completed',
  'closed',
  'cancelled',
]);

// 优先级 (1 紧急, 2 高, 3 中, 4 低)
const PrioritySchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal('1'), z.literal('2'), z.literal('3'), z.literal('4'),
]).transform(v => Number(v));

// 来源类型
const SourceTypeSchema = z.enum([
  'request', 'plan', 'preventive', 'manual', 'fault', 'other',
]);

// ===== 创建工单 =====
const CreateWorkOrderSchema = z
  .object({
    asset_code: z.string().min(1, '资产编号必填').max(100).trim(),
    asset_name: z.string().max(200).trim().optional().nullable(),
    title: z.string().min(1, '标题必填').max(200).trim(),
    description: z.string().max(2000).trim().optional().nullable(),
    priority: PrioritySchema.default(3),
    source_type: SourceTypeSchema.default('manual'),
    maintenance_plan_id: z.coerce.number().int().min(1).optional().nullable(),
    maintenance_request_id: z.coerce.number().int().min(1).optional().nullable(),
    planned_start_date: DateStringSchema.optional().nullable(),
    planned_end_date: DateStringSchema.optional().nullable(),
    estimated_hours: z.coerce.number().min(0).max(1000).optional().nullable(),
    assigned_to: z.string().max(50).trim().optional().nullable(),
    in_warranty: z.boolean().optional(),
    warranty_contract_id: z.coerce.number().int().min(1).optional().nullable(),
  })
  .strict();

// ===== 派工 =====
const AssignWorkOrderSchema = z
  .object({
    assigned_to: z.string().min(1, '负责人必填').max(50).trim(),
    remark: z.string().max(500).trim().optional().nullable(),
  })
  .strict();

// ===== 重新派工 =====
const ReassignWorkOrderSchema = AssignWorkOrderSchema;

// ===== 完成工单 (含签名) =====
const CompleteWorkOrderSchema = z
  .object({
    work_content: z.string().min(1, '维修内容必填').max(2000).trim(),
    maintenance_result: z.string().min(1, '维修结果必填').max(2000).trim(),
    actual_hours: z.coerce.number().min(0).max(1000).optional().nullable(),
    labor_cost: z.coerce.number().min(0).max(10000000).optional().nullable(),
    outsourcing_cost: z.coerce.number().min(0).max(10000000).optional().nullable(),
    other_cost: z.coerce.number().min(0).max(10000000).optional().nullable(),
    materials: z
      .array(
        z.object({
          name: z.string().min(1, '材料名必填').max(100).trim(),
          quantity: z.coerce.number().min(0.01).max(100000),
          unit_price: z.coerce.number().min(0).max(10000000),
        }),
      )
      .max(50, '材料最多 50 项')
      .optional(),
    engineer_signature: z
      .string()
      .min(50, '工程师签名必填 (手写后保存 base64)')
      .max(500000, '签名数据过大'),
    remark: z.string().max(500).trim().optional().nullable(),
  })
  .strict();

// ===== 评价工单 =====
const EvaluateWorkOrderSchema = z
  .object({
    rating: z.coerce.number().int().min(1, '评分至少 1').max(5, '评分最多 5'),
    comment: z.string().max(500).trim().optional().nullable(),
  })
  .strict();

// ===== 列表查询 =====
const ListWorkOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  asset_code: z.string().max(100).trim().optional(),
  assigned_to: z.string().max(50).trim().optional(),
  keyword: z.string().max(100).trim().optional(),
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.optional(),
});

// ===== 取消 / 关闭 =====
const CancelWorkOrderSchema = z
  .object({
    cancel_reason: z.string().min(1, '取消原因必填').max(500).trim(),
  })
  .strict();

module.exports = {
  IdParamSchema,
  StatusSchema,
  PrioritySchema,
  SourceTypeSchema,
  DateStringSchema,
  CreateWorkOrderSchema,
  AssignWorkOrderSchema,
  ReassignWorkOrderSchema,
  CompleteWorkOrderSchema,
  EvaluateWorkOrderSchema,
  ListWorkOrdersQuerySchema,
  CancelWorkOrderSchema,
};
