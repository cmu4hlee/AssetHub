/**
 * 部门 zod schemas
 */

const { z } = require('zod');

const IdParamSchema = z.object({
  id: z.string().min(1).max(50),
});

// 创建部门
const CreateDepartmentSchema = z
  .object({
    code: z
      .string()
      .min(1, '部门编码必填')
      .max(50, '部门编码最多 50 字符')
      .regex(/^[A-Za-z0-9_-]+$/, '编码只能包含字母/数字/下划线/连字符'),
    name: z.string().min(1, '部门名称必填').max(100).trim(),
    parent_id: z.string().max(50).trim().optional().nullable(),
    manager: z.string().max(50).trim().optional().nullable(),
    phone: z.string().regex(/^[\d\-+\s()]+$/, '电话格式无效').max(20).optional().nullable(),
    description: z.string().max(500).trim().optional().nullable(),
  })
  .strict();

// 更新部门
const UpdateDepartmentSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    parent_id: z.string().max(50).trim().optional().nullable(),
    manager: z.string().max(50).trim().optional().nullable(),
    phone: z.string().regex(/^[\d\-+\s()]+$/).max(20).optional().nullable(),
    description: z.string().max(500).trim().optional().nullable(),
  })
  .strict();

const ListDepartmentsQuerySchema = z.object({
  keyword: z.string().max(100).trim().optional(),
  parent_id: z.string().max(50).trim().optional(),
});

module.exports = {
  IdParamSchema,
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
  ListDepartmentsQuerySchema,
};
