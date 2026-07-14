/**
 * @swagger
 * /assets:
 *   get:
 *     summary: 获取资产列表
 *     tags: [库存管理]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: 在用
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *           example: CT
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 101
 *                       asset_code: ZC20260001
 *                       asset_name: CT球管
 *                       status: 在用
 *                   pagination:
 *                     page: 1
 *                     pageSize: 20
 *                     total: 1
 *                     totalPages: 1
 *       403:
 *         description: 缺少租户信息
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   post:
 *     summary: 新增资产
 *     tags: [库存管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_code, asset_name, category_id]
 *             properties:
 *               asset_code:
 *                 type: string
 *                 example: ZC20260002
 *               asset_name:
 *                 type: string
 *                 example: 便携超声
 *               category_id:
 *                 type: integer
 *                 example: 12
 *               purchase_date:
 *                 type: string
 *                 format: date
 *               purchase_price:
 *                 type: number
 *                 example: 180000
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   message: 资产添加成功
 *                   data:
 *                     id: 202
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /assets/{id}:
 *   get:
 *     summary: 获取资产详情
 *     tags: [库存管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 资产主键ID或资产编码
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       404:
 *         description: 资产不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   put:
 *     summary: 更新资产
 *     tags: [库存管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               asset_name:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               status:
 *                 type: string
 *                 example: 维修
 *               department_new:
 *                 type: string
 *                 example: DEP001
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   delete:
 *     summary: 删除资产
 *     tags: [库存管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /assets/import-template:
 *   get:
 *     summary: 下载资产导入模板
 *     tags: [库存管理]
 *     responses:
 *       200:
 *         description: Excel模板文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *
 * /assets/import:
 *   post:
 *     summary: 导入资产Excel
 *     tags: [库存管理]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 导入完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       400:
 *         description: 文件或格式错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /assets/export:
 *   get:
 *     summary: 导出资产Excel
 *     tags: [库存管理]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel导出文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *
 * /maintenance/requests:
 *   get:
 *     summary: 获取维修申请列表
 *     tags: [维修维护]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: pending
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   post:
 *     summary: 创建维修申请
 *     tags: [维修维护]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_code, issue_description]
 *             properties:
 *               asset_code:
 *                 type: string
 *                 example: ZC20260001
 *               issue_description:
 *                 type: string
 *                 example: 开机报错，无法完成扫描
 *               priority:
 *                 type: string
 *                 example: high
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /maintenance/requests/{id}:
 *   get:
 *     summary: 获取维修申请详情
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 更新维修申请
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   delete:
 *     summary: 删除维修申请
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /maintenance/requests/{id}/approve:
 *   post:
 *     summary: 审批维修申请
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approved:
 *                 type: boolean
 *                 example: true
 *               opinion:
 *                 type: string
 *                 example: 同意尽快处理
 *     responses:
 *       200:
 *         description: 审批完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /maintenance/logs:
 *   get:
 *     summary: 获取维护日志列表
 *     tags: [维修维护]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   post:
 *     summary: 创建维护日志
 *     tags: [维修维护]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_code, maintenance_type, maintenance_date]
 *             properties:
 *               asset_code:
 *                 type: string
 *                 example: ZC20260001
 *               maintenance_type:
 *                 type: string
 *                 example: corrective
 *               maintenance_date:
 *                 type: string
 *                 format: date
 *               cost:
 *                 type: number
 *                 example: 2300
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /maintenance/logs/{id}:
 *   get:
 *     summary: 获取维护日志详情
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 更新维护日志
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   delete:
 *     summary: 删除维护日志
 *     tags: [维修维护]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /maintenance/statistics:
 *   get:
 *     summary: 获取维护统计
 *     tags: [维修维护]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /quality-control/metrology:
 *   get:
 *     summary: 获取计量记录列表
 *     tags: [质量管理]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: asset_code
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   post:
 *     summary: 创建计量记录
 *     tags: [质量管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_code, metrology_type, metrology_date]
 *             properties:
 *               asset_code:
 *                 type: string
 *                 example: ZC20260001
 *               metrology_type:
 *                 type: string
 *                 example: 周检
 *               metrology_date:
 *                 type: string
 *                 format: date
 *               result:
 *                 type: string
 *                 example: 合格
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /quality-control/metrology/{id}:
 *   get:
 *     summary: 获取计量记录详情
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 更新计量记录
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   delete:
 *     summary: 删除计量记录
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /quality-control/quality-control:
 *   get:
 *     summary: 获取质量控制记录列表
 *     tags: [质量管理]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: qc_type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   post:
 *     summary: 创建质量控制记录
 *     tags: [质量管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [asset_code, qc_type, qc_date]
 *             properties:
 *               asset_code:
 *                 type: string
 *               qc_type:
 *                 type: string
 *               qc_date:
 *                 type: string
 *                 format: date
 *               result:
 *                 type: string
 *                 example: 合格
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /quality-control/quality-control/{id}:
 *   get:
 *     summary: 获取质量控制记录详情
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 更新质量控制记录
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   delete:
 *     summary: 删除质量控制记录
 *     tags: [质量管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /quality-control/quality-control/statistics:
 *   get:
 *     summary: 获取质量控制统计
 *     tags: [质量管理]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/requests:
 *   get:
 *     summary: 获取采购单列表
 *     tags: [采购管理]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: pending_approval
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *           example: 超声
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 9
 *                       request_no: CG1740555000000
 *                       title: 超声探头采购
 *                       status: pending_approval
 *                       budget: 98000
 *       400:
 *         description: 未选择租户
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   post:
 *     summary: 创建采购单
 *     tags: [采购管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: 麻醉机备件采购
 *               department:
 *                 type: string
 *                 example: 麻醉科
 *               applicant:
 *                 type: string
 *                 example: 张三
 *               budget:
 *                 type: number
 *                 example: 120000
 *               remark:
 *                 type: string
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/requests/{id}:
 *   put:
 *     summary: 更新采购单
 *     tags: [采购管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/requests/{id}/approve:
 *   put:
 *     summary: 审批采购单
 *     tags: [采购管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approved:
 *                 type: boolean
 *                 example: true
 *               opinion:
 *                 type: string
 *                 example: 预算合理，同意采购
 *     responses:
 *       200:
 *         description: 审批结果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/requests/{id}/execute:
 *   put:
 *     summary: 更新采购执行状态
 *     tags: [采购管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completed:
 *                 type: boolean
 *                 example: false
 *               result:
 *                 type: string
 *                 example: 已下单，预计7天到货
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/requests/{id}/files:
 *   get:
 *     summary: 获取采购单附件列表
 *     tags: [采购管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   post:
 *     summary: 上传采购单附件
 *     tags: [采购管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               file_type:
 *                 type: string
 *                 example: contract
 *     responses:
 *       200:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /procurement/stats:
 *   get:
 *     summary: 获取采购统计
 *     tags: [采购管理]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   success: true
 *                   data:
 *                     total: 18
 *                     total_budget: 586000
 *                     by_status:
 *                       - status: pending_approval
 *                         count: 3
 *                       - status: approved
 *                         count: 4
 *                       - status: completed
 *                         count: 11
 */

