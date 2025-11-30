-- ============================================
-- 真人荷官视讯后台管理系统 V2.1.3 - 收款方式管理
-- 支持 USDT/银行卡/支付宝/微信等多种收款渠道
-- ============================================

-- 收款方式表
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method_code VARCHAR(50) UNIQUE NOT NULL, -- 方式代码: usdt_trc20, usdt_erc20, bank_card, alipay, wechat
  method_name VARCHAR(100) NOT NULL, -- 显示名称: USDT-TRC20, 银行卡转账
  method_type VARCHAR(20) NOT NULL, -- 类型: crypto (加密货币), bank (银行), ewallet (电子钱包)
  currency VARCHAR(10) DEFAULT 'CNY', -- 货币: CNY, USD, USDT
  icon VARCHAR(200), -- 图标URL
  
  -- 收款账户信息
  account_name VARCHAR(100), -- 收款人姓名/钱包地址标签
  account_number VARCHAR(200), -- 账号/钱包地址
  bank_name VARCHAR(100), -- 银行名称 (银行卡用)
  bank_branch VARCHAR(200), -- 开户支行
  qr_code_url VARCHAR(500), -- 收款二维码URL
  
  -- 限额设置
  min_amount DECIMAL(14,2) DEFAULT 100.00, -- 最低限额
  max_amount DECIMAL(14,2) DEFAULT 1000000.00, -- 最高限额
  daily_limit DECIMAL(14,2), -- 每日限额 (NULL表示不限)
  
  -- 手续费设置
  fee_type VARCHAR(10) DEFAULT 'none', -- none: 无手续费, fixed: 固定, percent: 百分比
  fee_value DECIMAL(10,4) DEFAULT 0, -- 手续费数值
  
  -- 汇率设置 (加密货币用)
  exchange_rate DECIMAL(14,6), -- 汇率 (如 1 USDT = 7.25 CNY)
  auto_rate TINYINT DEFAULT 0, -- 是否自动获取汇率
  
  -- 显示设置
  display_order INTEGER DEFAULT 0, -- 显示顺序
  status TINYINT DEFAULT 1, -- 1:启用 0:禁用
  is_default TINYINT DEFAULT 0, -- 是否默认
  
  -- 备注
  description TEXT, -- 使用说明
  admin_notes TEXT, -- 管理员备注
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- 创建者admin_id
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 收款方式使用记录表 (统计用)
CREATE TABLE IF NOT EXISTS payment_method_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method_id INTEGER NOT NULL,
  stat_date DATE NOT NULL,
  deposit_count INTEGER DEFAULT 0, -- 存款笔数
  deposit_amount DECIMAL(14,2) DEFAULT 0, -- 存款金额
  success_count INTEGER DEFAULT 0, -- 成功笔数
  success_amount DECIMAL(14,2) DEFAULT 0, -- 成功金额
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (method_id) REFERENCES payment_methods(id),
  UNIQUE(method_id, stat_date)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_status ON payment_methods(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_currency ON payment_methods(currency);
CREATE INDEX IF NOT EXISTS idx_payment_method_stats_date ON payment_method_stats(stat_date);

-- 修改存款表添加收款方式关联
-- ALTER TABLE deposits ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id);
-- 注: 如果已有数据, 需要单独执行此ALTER语句
