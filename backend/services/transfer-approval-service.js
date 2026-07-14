/**
 * 资产调配核心逻辑（申请 / 审批 / 拒绝 / 删除 / 查询）
 * ------------------------------------------------------------------
 * 设计约定：
 *  1. 统一以 `asset_transfer_requests` 表作为调配申请的单一数据源。
 *     （历史遗留的 transfer_records 表已进入废弃流程，本模块不再依赖它做业务判断，
 *      仅在删除时做可选的清理，且忽略“表不存在”错误以免阻塞。）
 *  2. 资产状态机：在用 -> 调配中(申请时) -> 在用(审批通过并实际调拨后)。
 *     审批通过即执行调拨（更新 assets 的部门与状态），不存在独立的 "completed" 状态，
 *     因此 asset_transfer_requests 的状态枚举固定为 pending / approved / rejected。
 *  3. 所有函数都在“调用方已开启的事务连接(connection)”上执行，自身不 commit / rollback；
 *     数据库异常直接向上抛出，由调用方回滚。
 *  4. 业务校验失败统一返回 { success:false, message, code }，其中 code 用于映射 HTTP 状态码，
 *     便于路由层给出准确的错误提示与回滚。
 */

/**
 * 查询单条调配申请（带租户隔离）
 */
async function findTransferRequestById(connection, id, tenantId) {
  const [rows] = await connection.execute(
    'SELECT * FROM asset_transfer_requests WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  return rows[0] || null;
}

/**
 * 获取并锁定资产（兼容 asset_code 或数值 id），用于调配上下文
 */
async function getAssetForTransfer(connection, tenantId, assetIdentifier) {
  const normalized = assetIdentifier == null ? '' : String(assetIdentifier).trim();
  if (!normalized) return null;
  const [rows] = await connection.execute(
    `SELECT *
     FROM assets
     WHERE tenant_id = ?
       AND is_deleted = 0
       AND (asset_code = ? OR CAST(id AS CHAR) = ?)
     LIMIT 1
     FOR UPDATE`,
    [tenantId, normalized, normalized],
  );
  return rows[0] || null;
}

/**
 * 判断某资产是否还存在“待审批”的调配申请（用于去重与资产状态回滚判断）
 * @param {number|string} excludeId 排除当前申请（用于删除自身时的判断）
 */
async function hasOtherPendingTransfer(connection, assetCode, tenantId, excludeId = null) {
  if (!assetCode) return false;
  let sql =
    'SELECT id FROM asset_transfer_requests WHERE asset_code = ? AND tenant_id = ? AND status = ?';
  const params = [assetCode, tenantId, 'pending'];
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await connection.execute(sql, params);
  return rows.length > 0;
}

/**
 * 写入资产变更日志（表缺失时降级跳过，不阻塞主流程）
 */
async function writeAssetChangeLog(connection, { assetCode, fieldName, oldValue, newValue, changedBy, tenantId }) {
  try {
    await connection.execute(
      `INSERT INTO asset_change_logs
         (asset_code, field_name, old_value, new_value, changed_by, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [assetCode, fieldName, oldValue ?? null, newValue ?? null, changedBy, tenantId],
    );
  } catch (logErr) {
    // 变更日志是审计辅助信息，写入失败不应导致调配主流程失败
    if (logErr.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[transfer] asset_change_logs 表不存在，跳过变更日志写入');
    } else {
      console.warn('[transfer] 资产修改日志写入失败:', logErr.message);
    }
  }
}

/**
 * 提交调配申请
 *  校验：资产存在、资产为“在用”、同一资产无待审批申请；
 *  副作用：将资产状态置为“调配中”，写入 asset_transfer_requests（pending）。
 */
async function createTransferRequest(connection, opts) {
  const { tenantId, assetCode, assetId, assetName, currentDepartment, targetDepartment, reason, applicant } = opts;

  if (!assetCode || !targetDepartment || !applicant) {
    return { success: false, message: '资产编码、目标科室和申请人不能为空', code: 400 };
  }
  if (!assetId) {
    return { success: false, message: '资产不存在', code: 404 };
  }
  if (currentDepartment && currentDepartment === targetDepartment) {
    return { success: false, message: '调入科室不能与当前科室相同', code: 400 };
  }

  // 锁定资产，避免并发重复申请
  const asset = await getAssetForTransfer(connection, tenantId, assetCode);
  if (!asset) {
    return { success: false, message: '资产不存在', code: 404 };
  }

  if (asset.status !== '在用') {
    return {
      success: false,
      message: `只有“在用”状态的资产可以申请调拨，当前状态为“${asset.status || '未知'}”`,
      code: 400,
    };
  }

  if (await hasOtherPendingTransfer(connection, asset.asset_code, tenantId)) {
    return { success: false, message: '该资产已存在待审批的调配申请，请先处理', code: 400 };
  }

  const [result] = await connection.execute(
    `INSERT INTO asset_transfer_requests
       (tenant_id, asset_code, asset_name, current_department, target_department, reason, applicant, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [
      tenantId,
      asset.asset_code,
      asset.asset_name || assetName || null,
      asset.department_new || asset.department || currentDepartment || null,
      targetDepartment,
      reason || null,
      applicant,
    ],
  );

  // 标记为调配中，防止重复申请
  await connection.execute(
    'UPDATE assets SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
    ['调配中', asset.id, tenantId],
  );

  return {
    success: true,
    id: result.insertId,
    asset_code: asset.asset_code,
    asset_name: asset.asset_name || assetName || null,
    status: 'pending',
  };
}

/**
 * 审批调配申请
 * @param {boolean} opts.approved true=批准并实际调拨，false=拒绝并回滚资产状态
 */
async function approveTransferRequest(connection, opts) {
  const { id, approved, approver, tenantId, comment } = opts;
  if (id == null || approved == null || !approver || tenantId == null) {
    return { success: false, message: '参数不完整', code: 400 };
  }

  const request = await findTransferRequestById(connection, id, tenantId);
  if (!request) {
    return { success: false, message: '调配申请不存在', code: 404 };
  }

  if (request.status !== 'pending') {
    return {
      success: false,
      message: `该调配申请已处理，当前状态：${request.status === 'approved' ? '已批准' : '已拒绝'}`,
      code: 400,
    };
  }

  const asset = await getAssetForTransfer(connection, tenantId, request.asset_code);
  if (!asset) {
    return { success: false, message: '资产不存在，无法审批', code: 404 };
  }

  if (approved) {
    // 批准：必须处于调配中，审批即执行实际调拨
    if (asset.status !== '调配中') {
      return {
        success: false,
        message: `资产当前状态为“${asset.status || '未知'}”，无法批准调配。资产须处于“调配中”才能批准。`,
        code: 400,
      };
    }

    // 更新资产部门与状态（department 与 department_new 保持一致）
    await connection.execute(
      `UPDATE assets
         SET department = ?, department_new = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [request.target_department, request.target_department, '在用', asset.id, tenantId],
    );

    await writeAssetChangeLog(connection, {
      assetCode: request.asset_code,
      fieldName: '部门调配',
      oldValue: request.current_department,
      newValue: request.target_department,
      changedBy: approver,
      tenantId,
    });

    const [upd] = await connection.execute(
      `UPDATE asset_transfer_requests
         SET status = 'approved', approved_by = ?, approved_at = NOW(), comment = ?
       WHERE id = ? AND tenant_id = ?`,
      [approver, comment || null, id, tenantId],
    );
    if (upd.affectedRows === 0) {
      return { success: false, message: '调配审批失败', code: 500 };
    }

    return { success: true, message: '调配申请已批准并完成调拨' };
  }

  // 拒绝：仅更新申请状态，并按需回滚资产状态
  const [upd] = await connection.execute(
    `UPDATE asset_transfer_requests
       SET status = 'rejected', approved_by = ?, approved_at = NOW(), comment = ?
     WHERE id = ? AND tenant_id = ?`,
    [approver, comment || null, id, tenantId],
  );
  if (upd.affectedRows === 0) {
    return { success: false, message: '调配驳回失败', code: 500 };
  }

  // 仅当资产仍处于“调配中”且无其他待审批申请时，才恢复为“在用”
  if (asset.status === '调配中' && !(await hasOtherPendingTransfer(connection, request.asset_code, tenantId, id))) {
    await connection.execute(
      'UPDATE assets SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      ['在用', asset.id, tenantId],
    );
  }

  return { success: true, message: '调配申请已拒绝' };
}

/**
 * 拒绝调配申请（语义化封装，便于其它调用方使用）
 */
async function rejectTransferRequest(connection, opts) {
  return approveTransferRequest(connection, { ...opts, approved: false });
}

/**
 * 删除调配申请
 *  - pending / rejected：若资产仍为调配中且无私下其它待审批申请，则恢复为“在用”
 *  - approved：调拨已实际执行，资产已被移动到目标科室并置为在用，不做回滚
 *  - 同时清理遗留的 transfer_records（表不存在则忽略）
 */
async function deleteTransferRequest(connection, opts) {
  const { id, tenantId } = opts;
  if (id == null || tenantId == null) {
    return { success: false, message: '参数不完整', code: 400 };
  }

  const request = await findTransferRequestById(connection, id, tenantId);
  if (!request) {
    return { success: false, message: '调配申请不存在', code: 404 };
  }

  if (request.status === 'pending' || request.status === 'rejected') {
    const asset = await getAssetForTransfer(connection, tenantId, request.asset_code);
    if (asset && asset.status === '调配中' && !(await hasOtherPendingTransfer(connection, request.asset_code, tenantId, id))) {
      await connection.execute(
        'UPDATE assets SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        ['在用', asset.id, tenantId],
      );
    }
  }

  await connection.execute(
    'DELETE FROM asset_transfer_requests WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );

  // 清理遗留 transfer_records（历史表，可能不存在）
  try {
    await connection.execute(
      `DELETE FROM transfer_records
       WHERE asset_code = ? AND tenant_id = ? AND status IN (?, ?)`,
      [request.asset_code, tenantId, '待审批', '已批准'],
    );
  } catch (delErr) {
    if (delErr.code !== 'ER_NO_SUCH_TABLE') throw delErr;
  }

  return { success: true, message: '调配申请已删除' };
}

module.exports = {
  findTransferRequestById,
  getAssetForTransfer,
  hasOtherPendingTransfer,
  createTransferRequest,
  approveTransferRequest,
  rejectTransferRequest,
  deleteTransferRequest,
};
