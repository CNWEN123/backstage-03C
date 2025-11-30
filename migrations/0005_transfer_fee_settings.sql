-- 转账手续费设置表
CREATE TABLE IF NOT EXISTS transfer_fee_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  min_amount REAL DEFAULT 0,
  max_amount REAL,
  fee_type TEXT NOT NULL DEFAULT 'fixed', -- fixed: 固定金额, percent: 百分比
  fee_value REAL NOT NULL DEFAULT 0,
  min_fee REAL,
  max_fee REAL,
  is_enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO transfer_fee_settings (name, min_amount, max_amount, fee_type, fee_value, min_fee, max_fee, priority, description) VALUES
('小额免费', 0, 1000, 'fixed', 0, NULL, NULL, 100, '1000以下免手续费'),
('小额转账(1000-5000)', 1000, 5000, 'percent', 0.005, 5, 25, 90, '1000-5000收取0.5%'),
('中额转账(5000-20000)', 5000, 20000, 'percent', 0.003, 15, 60, 80, '5000-20000收取0.3%'),
('大额转账(20000以上)', 20000, NULL, 'percent', 0.002, 40, 100, 70, '20000以上收取0.2%');
