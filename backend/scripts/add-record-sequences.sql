-- ============================================
-- 补建计量/质控单号序列表
-- ============================================
-- 适用场景：
--   metrology-service.js / quality-control-service.js 用到的
--   metrology_record_sequence / qc_record_sequence 两张表没有建过。
--   修复后单号生成会走数据库序列而非时间戳+随机数 fallback。
-- ============================================

USE zcgl;

CREATE TABLE IF NOT EXISTS metrology_record_sequence (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date_key VARCHAR(8) NOT NULL COMMENT '日期键 YYYYMMDD',
  sequence_value BIGINT NOT NULL DEFAULT 1 COMMENT '当日序号',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_date_key (date_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计量单号序列表';

CREATE TABLE IF NOT EXISTS qc_record_sequence (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date_key VARCHAR(8) NOT NULL COMMENT '日期键 YYYYMMDD',
  sequence_value BIGINT NOT NULL DEFAULT 1 COMMENT '当日序号',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_date_key (date_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质控单号序列表';

-- 验证
SELECT 'metrology_record_sequence' AS table_name, COUNT(*) AS exists_check
FROM information_schema.tables
WHERE table_schema = 'zcgl' AND table_name = 'metrology_record_sequence'
UNION ALL
SELECT 'qc_record_sequence', COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'zcgl' AND table_name = 'qc_record_sequence';
