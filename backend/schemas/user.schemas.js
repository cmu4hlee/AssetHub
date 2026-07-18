/**
 * 用户 / 认证 zod schemas
 */

const { z } = require('zod');

// 登录
const LoginSchema = z
  .object({
    username: z.string().min(1, '用户名必填').max(50).trim(),
    password: z.string().min(1, '密码必填').max(100),
    tenantCode: z.string().max(50).trim().optional().nullable(),
    captcha: z.string().max(10).trim().optional().nullable(),
  })
  .strict();

// 注册
const RegisterSchema = z
  .object({
    username: z
      .string()
      .min(3, '用户名至少 3 字符')
      .max(50, '用户名最多 50 字符')
      .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母/数字/下划线'),
    password: z
      .string()
      .min(8, '密码至少 8 字符')
      .max(100, '密码最多 100 字符')
      .regex(/[A-Za-z]/, '密码必须包含字母')
      .regex(/\d/, '密码必须包含数字'),
    real_name: z.string().min(1, '姓名必填').max(50).trim(),
    email: z.string().email('邮箱格式无效').max(100).optional().nullable(),
    phone: z
      .string()
      .regex(/^1[3-9]\d{9}$/, '手机号格式无效')
      .optional()
      .nullable(),
    tenantCode: z.string().max(50).trim().optional().nullable(),
  })
  .strict();

// 修改密码
const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '原密码必填').max(100),
    newPassword: z
      .string()
      .min(8, '新密码至少 8 字符')
      .max(100, '新密码最多 100 字符')
      .regex(/[A-Za-z]/, '新密码必须包含字母')
      .regex(/\d/, '新密码必须包含数字'),
  })
  .strict()
  .refine(d => d.oldPassword !== d.newPassword, {
    message: '新密码不能与原密码相同',
    path: ['newPassword'],
  });

// 创建用户 (管理员)
const CreateUserSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母/数字/下划线'),
    password: z.string().min(8).max(100),
    real_name: z.string().min(1).max(50).trim(),
    email: z.string().email().max(100).optional().nullable(),
    phone: z.string().regex(/^1[3-9]\d{9}$/).optional().nullable(),
    role: z.string().max(50).trim().optional().nullable(),
    department: z.string().max(50).trim().optional().nullable(),
    status: z.enum(['active', 'inactive', 'locked']).default('active'),
  })
  .strict();

// 更新用户
const UpdateUserSchema = z
  .object({
    real_name: z.string().min(1).max(50).trim().optional(),
    email: z.string().email().max(100).optional().nullable(),
    phone: z.string().regex(/^1[3-9]\d{9}$/).optional().nullable(),
    role: z.string().max(50).trim().optional().nullable(),
    department: z.string().max(50).trim().optional().nullable(),
    status: z.enum(['active', 'inactive', 'locked']).optional(),
  })
  .strict();

// 列表查询
const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
  role: z.string().max(50).trim().optional(),
  department: z.string().max(50).trim().optional(),
  keyword: z.string().max(100).trim().optional(),
});

const IdParamSchema = z.object({
  id: z.coerce.number().int().min(1),
});

module.exports = {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersQuerySchema,
  IdParamSchema,
};
