-- ============================================================
-- 巡检签字字段扩长 + 复核意见字段补建
-- 原因:
--   1. signature_inspector / signature_reviewer 存手写签名 base64 PNG,
--      原 VARCHAR(500) 太小,会被静默截断(实际签名图通常 5K~50K 字符)
--   2. reviewed_remark 字段原本在 003_enhancements.sql 中新增,但 003 未执行
--      此处一并补上,保证 reviewRecord API 落库成功
-- ============================================================

-- 先无条件 MODIFY 字段类型(即使已是 MEDIUMTEXT 也安全)
ALTER TABLE inspection_records
  MODIFY COLUMN signature_inspector MEDIUMTEXT COMMENT '巡检人签字(base64 PNG / 图片URL)',
  MODIFY COLUMN signature_reviewer MEDIUMTEXT COMMENT '复核人签字(base64 PNG)';

-- 用存储过程判断字段是否存在,避免 MySQL 不支持 IF NOT EXISTS 语法
DROP PROCEDURE IF EXISTS _add_reviewed_remark;
DELIMITER //
CREATE PROCEDURE _add_reviewed_remark()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inspection_records'
      AND COLUMN_NAME = 'reviewed_remark'
  ) THEN
    ALTER TABLE inspection_records
      ADD COLUMN reviewed_remark VARCHAR(500) DEFAULT NULL COMMENT '复核意见' AFTER signature_reviewer;
  END IF;
END//
DELIMITER ;
CALL _add_reviewed_remark();
DROP PROCEDURE _add_reviewed_remark;

SELECT '巡检签字字段扩长 + reviewed_remark 补建完成' AS result;
