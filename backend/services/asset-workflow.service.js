const axios = require('axios');
const db = require('../config/database');
const { publishAsync } = require('../core/EventBus');
const logger = require('../config/logger');

const ALLOWED_UPDATE_FIELDS = new Set([
  'location',
  'department',
  'department_new',
  'responsible_person',
  'status',
  'remark',
]);

async function getDefaultWorkflowId(tenantId) {
  if (tenantId) {
    const [rows] = await db.execute(
      'SELECT id FROM asset_workflows WHERE tenant_id = ? AND is_default = 1 ORDER BY id ASC LIMIT 1',
      [tenantId],
    );
    return rows[0]?.id || null;
  }
  const [rows] = await db.execute(
    'SELECT id FROM asset_workflows WHERE is_default = 1 ORDER BY id ASC LIMIT 1',
  );
  return rows[0]?.id || null;
}

async function getWorkflow(workflowId, tenantId) {
  if (tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM asset_workflows WHERE id = ? AND tenant_id = ?',
      [workflowId, tenantId],
    );
    return rows[0] || null;
  }
  const [rows] = await db.execute('SELECT * FROM asset_workflows WHERE id = ?', [workflowId]);
  return rows[0] || null;
}

async function getWorkflowStates(workflowId, tenantId) {
  if (tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM asset_workflow_states WHERE workflow_id = ? AND tenant_id = ? ORDER BY sort_order, id',
      [workflowId, tenantId],
    );
    return rows;
  }
  const [rows] = await db.execute(
    'SELECT * FROM asset_workflow_states WHERE workflow_id = ? ORDER BY sort_order, id',
    [workflowId],
  );
  return rows;
}

async function getWorkflowTransitions(workflowId, tenantId) {
  if (tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM asset_workflow_transitions WHERE workflow_id = ? AND is_active = 1 AND tenant_id = ? ORDER BY sort_order, id',
      [workflowId, tenantId],
    );
    return rows;
  }
  const [rows] = await db.execute(
    'SELECT * FROM asset_workflow_transitions WHERE workflow_id = ? AND is_active = 1 ORDER BY sort_order, id',
    [workflowId],
  );
  return rows;
}

async function getTransitionActions(transitionId, tenantId) {
  if (tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM asset_workflow_actions WHERE transition_id = ? AND is_active = 1 AND tenant_id = ? ORDER BY sort_order, id',
      [transitionId, tenantId],
    );
    return rows;
  }
  const [rows] = await db.execute(
    'SELECT * FROM asset_workflow_actions WHERE transition_id = ? AND is_active = 1 ORDER BY sort_order, id',
    [transitionId],
  );
  return rows;
}

async function getAssetByIdOrCode(connection, id, tenantFilter) {
  const isNumeric = Number.isInteger(Number(id));
  const whereClause = tenantFilter?.whereClause ? tenantFilter.whereClause : '';
  const params = tenantFilter?.params ? [...tenantFilter.params] : [];
  const [rows] = await connection.execute(
    `SELECT * FROM assets WHERE ${isNumeric ? 'id' : 'asset_code'} = ? ${whereClause} FOR UPDATE`,
    [id, ...params],
  );
  return rows[0] || null;
}

async function getAllowedTransitions(assetStatus, workflowId) {
  const [rows] = await db.execute(
    `SELECT * FROM asset_workflow_transitions
     WHERE workflow_id = ? AND is_active = 1 AND from_state = ?
     ORDER BY sort_order, id`,
    [workflowId, assetStatus],
  );
  return rows;
}

async function executeAction(action, context, connection) {
  const actionType = action.action_type;
  const result = { action_id: action.id, action_type: actionType, success: true };

  try {
    const config = action.action_config ? JSON.parse(action.action_config) : {};

    if (actionType === 'webhook') {
      const {url} = config;
      const method = (config.method || 'POST').toUpperCase();
      const headers = config.headers || {};
      const timeout = Number(config.timeout_ms) || 5000;
      const payload = config.payload || {
        asset: context.asset,
        transition: context.transition,
        workflow: context.workflow,
        user: context.user,
        reason: context.reason,
        metadata: context.metadata || {},
      };

      if (!url) {
        throw new Error('Webhook URL is required');
      }

      await axios({
        url,
        method,
        data: payload,
        headers,
        timeout,
      });

      result.payload = payload;
    } else if (actionType === 'update_asset_fields') {
      const fields = config.fields || {};
      const updates = [];
      const params = [];

      Object.entries(fields).forEach(([key, value]) => {
        if (ALLOWED_UPDATE_FIELDS.has(key)) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      });

      if (updates.length > 0) {
        params.push(context.asset.id, context.asset.tenant_id);
        await connection.execute(
          `UPDATE assets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
          params,
        );
        result.updated_fields = Object.keys(fields).filter(key => ALLOWED_UPDATE_FIELDS.has(key));
      } else {
        result.warning = 'No valid fields to update';
      }
    } else {
      result.success = false;
      result.error = `Unsupported action type: ${actionType}`;
    }
  } catch (error) {
    result.success = false;
    result.error = error.message;
  }

  return result;
}

async function applyTransition({
  assetIdOrCode,
  transitionId,
  reason,
  user,
  tenantFilter,
  metadata,
  tenantId,
}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const asset = await getAssetByIdOrCode(connection, assetIdOrCode, tenantFilter);
    if (!asset) {
      throw new Error('ASSET_NOT_FOUND');
    }

    const transitionQuery = `
      SELECT t.* FROM asset_workflow_transitions t
      INNER JOIN asset_workflows w ON t.workflow_id = w.id
      WHERE t.id = ? AND t.is_active = 1 ${tenantId ? 'AND w.tenant_id = ?' : ''}
    `;
    const transitionParams = tenantId ? [transitionId, tenantId] : [transitionId];
    const [transitionRows] = await connection.execute(transitionQuery, transitionParams);
    const transition = transitionRows[0];
    if (!transition) {
      throw new Error('TRANSITION_NOT_FOUND');
    }

    if (transition.from_state !== asset.status) {
      throw new Error('INVALID_TRANSITION_STATE');
    }

    if (transition.require_reason && (!reason || String(reason).trim() === '')) {
      throw new Error('REASON_REQUIRED');
    }

    await connection.execute(
      `UPDATE assets SET status = ?, updated_at = NOW(), updated_by = ?
       WHERE id = ? AND tenant_id = ?`,
      [transition.to_state, user?.username || null, asset.id, asset.tenant_id],
    );

    const [logResult] = await connection.execute(
      `INSERT INTO asset_workflow_logs (
        tenant_id, asset_id, workflow_id, transition_id, from_state, to_state,
        operator_id, operator_name, reason, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        asset.tenant_id,
        asset.id,
        transition.workflow_id,
        transition.id,
        transition.from_state,
        transition.to_state,
        user?.id || null,
        user?.username || null,
        reason || null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );

    const actions = await getTransitionActions(transition.id, tenantId);
    const workflow = await getWorkflow(transition.workflow_id, tenantId);

    const actionResults = [];
    for (const action of actions) {
      const actionResult = await executeAction(
        action,
        { asset, transition, workflow, user, reason, metadata },
        connection,
      );
      actionResults.push(actionResult);
    }

    if (actionResults.length > 0) {
      await connection.execute(
        'UPDATE asset_workflow_logs SET action_result = ? WHERE id = ?',
        [JSON.stringify(actionResults), logResult.insertId],
      );
    }

    await connection.commit();

    // 资产状态迁移完成后发飞书通知事件（异步，不阻塞主流程）
    try {
      publishAsync('asset_workflow:transition', {
        assetId: asset.id,
        assetCode: asset.asset_code,
        assetName: asset.asset_name,
        fromState: transition.from_state,
        toState: transition.to_state,
        transitionName: transition.transition_name || transition.name,
        reason,
        operatorId: user?.id,
        operatorName: user?.username,
        tenantId: asset.tenant_id,
      }).catch(e => logger.warn('发布 asset_workflow:transition 事件失败:', e.message));
    } catch (_) {}

    return {
      asset: { ...asset, status: transition.to_state },
      transition,
      actions: actionResults,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getDefaultWorkflowId,
  getWorkflow,
  getWorkflowStates,
  getWorkflowTransitions,
  getTransitionActions,
  getAllowedTransitions,
  applyTransition,
};
