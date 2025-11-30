-- 真人荷官视讯后台管理系统数据库架构 V2.1
-- 创建时间: 2025-11-29

-- ============================================
-- 1. 管理员与权限表
-- ============================================

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50),
  role VARCHAR(20) NOT NULL DEFAULT 'operator', -- super_admin, finance, risk_officer, operator, cs
  email VARCHAR(100),
  phone VARCHAR(20),
  two_fa_secret VARCHAR(50),
  two_fa_enabled TINYINT DEFAULT 0,
  ip_whitelist TEXT, -- JSON array
  status TINYINT DEFAULT 1, -- 1:正常 0:锁定
  last_login_at DATETIME,
  last_login_ip VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  module VARCHAR(50) NOT NULL, -- dashboard, player, agent, finance, etc.
  action VARCHAR(50) NOT NULL, -- create, update, delete, approve, reject
  target_type VARCHAR(50), -- player, agent, withdrawal, etc.
  target_id INTEGER,
  details TEXT, -- JSON
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- ============================================
-- 2. 玩家管理表
-- ============================================

-- 玩家表
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  real_name VARCHAR(50),
  balance DECIMAL(12,2) DEFAULT 0.00,
  status TINYINT DEFAULT 1, -- 1:正常 2:冻结 3:审核中
  agent_id INTEGER, -- 上级代理ID
  vip_level INTEGER DEFAULT 0, -- VIP等级
  kyc_status TINYINT DEFAULT 0, -- 0:未认证 1:已认证 2:认证失败
  kyc_documents TEXT, -- JSON
  phone VARCHAR(20),
  email VARCHAR(100),
  register_ip VARCHAR(50),
  register_device TEXT, -- JSON
  last_login_at DATETIME,
  last_login_ip VARCHAR(50),
  last_login_device TEXT, -- JSON
  risk_tags TEXT, -- JSON array: ['套利嫌疑', '刷水客', '对冲账户']
  commission_scheme_id INTEGER, -- 洗码方案ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (commission_scheme_id) REFERENCES commission_schemes(id)
);

-- 玩家标签表
CREATE TABLE IF NOT EXISTS player_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  tag VARCHAR(50) NOT NULL, -- VIP, 高风险, 套利, 刷水
  added_by INTEGER, -- admin_id
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (added_by) REFERENCES admins(id)
);

-- ============================================
-- 3. 代理层级表
-- ============================================

-- 代理表
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  agent_level TINYINT NOT NULL, -- 1:股东 2:总代 3:代理
  parent_id INTEGER, -- 上级代理ID
  agent_path VARCHAR(500), -- 代理路径 如: /1/5/12/
  profit_share DECIMAL(5,2), -- 占成比例
  commission_rate DECIMAL(6,4), -- 洗码率
  balance DECIMAL(12,2) DEFAULT 0.00,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES agents(id)
);

-- 代理佣金记录
CREATE TABLE IF NOT EXISTS agent_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_bet DECIMAL(12,2) DEFAULT 0.00,
  valid_bet DECIMAL(12,2) DEFAULT 0.00,
  commission_amount DECIMAL(12,2) DEFAULT 0.00,
  status TINYINT DEFAULT 0, -- 0:待审核 1:已发放 2:已拒绝
  settled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- ============================================
-- 4. 财务管理表
-- ============================================

-- 存款记录
CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20), -- bank_transfer, alipay, wechat, usdt
  payment_channel VARCHAR(50),
  status TINYINT DEFAULT 0, -- 0:待处理 1:成功 2:失败 3:已取消
  processed_by INTEGER, -- admin_id
  processed_at DATETIME,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (processed_by) REFERENCES admins(id)
);

-- 提款记录
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  bank_name VARCHAR(50),
  bank_account VARCHAR(50),
  account_name VARCHAR(50),
  required_turnover DECIMAL(12,2), -- 需要的流水
  actual_turnover DECIMAL(12,2), -- 实际流水
  turnover_check TINYINT DEFAULT 0, -- 0:未达标 1:已达标
  status TINYINT DEFAULT 0, -- 0:待审核 1:已批准 2:已拒绝 3:处理中 4:已完成
  reviewed_by INTEGER, -- admin_id
  reviewed_at DATETIME,
  processed_by INTEGER, -- admin_id
  processed_at DATETIME,
  reject_reason TEXT,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (reviewed_by) REFERENCES admins(id),
  FOREIGN KEY (processed_by) REFERENCES admins(id)
);

-- 资金流水表
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- deposit, withdraw, bet, payout, bonus, commission, adjustment
  order_no VARCHAR(50),
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  related_id INTEGER, -- 关联的注单ID或其他ID
  remark TEXT,
  created_by INTEGER, -- admin_id for manual adjustments
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- ============================================
-- 5. 游戏与注单表
-- ============================================

-- 游戏桌台表
CREATE TABLE IF NOT EXISTS game_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_code VARCHAR(20) UNIQUE NOT NULL, -- BAC-001, DT-002, ROU-003
  game_type VARCHAR(20) NOT NULL, -- baccarat, dragon_tiger, roulette, sicbo, bull_bull
  table_name VARCHAR(50) NOT NULL,
  min_bet DECIMAL(12,2) DEFAULT 10.00,
  max_bet DECIMAL(12,2) DEFAULT 100000.00,
  limit_group VARCHAR(20), -- A组, B组, VIP组
  video_stream_main VARCHAR(200), -- WebRTC主线路
  video_stream_backup VARCHAR(200), -- FLV备用线路
  status TINYINT DEFAULT 1, -- 1:运行中 0:维护中
  current_dealer_id INTEGER, -- 当前荷官ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_dealer_id) REFERENCES dealers(id)
);

-- 注单表
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet_no VARCHAR(50) UNIQUE NOT NULL,
  player_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  game_round VARCHAR(50) NOT NULL, -- 游戏局号
  game_type VARCHAR(20) NOT NULL,
  bet_type VARCHAR(50) NOT NULL, -- banker, player, dragon, tiger, red, black, etc.
  bet_amount DECIMAL(12,2) NOT NULL,
  odds DECIMAL(8,2) NOT NULL,
  payout_amount DECIMAL(12,2) DEFAULT 0.00,
  profit_loss DECIMAL(12,2) DEFAULT 0.00, -- 盈亏 = payout - bet_amount
  valid_bet DECIMAL(12,2) DEFAULT 0.00, -- 有效投注额
  status TINYINT DEFAULT 0, -- 0:未结算 1:已结算 2:已作废 3:已退还
  result_data TEXT, -- JSON: 开奖结果详情
  video_replay_url VARCHAR(200), -- 视频回放URL
  ip_address VARCHAR(50),
  bet_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME,
  voided_by INTEGER, -- admin_id 作废操作人
  voided_at DATETIME,
  void_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (table_id) REFERENCES game_tables(id),
  FOREIGN KEY (voided_by) REFERENCES admins(id)
);

-- 游戏结果表
CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL,
  game_round VARCHAR(50) UNIQUE NOT NULL,
  game_type VARCHAR(20) NOT NULL,
  result_data TEXT NOT NULL, -- JSON
  video_url VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES game_tables(id)
);

-- ============================================
-- 6. 洗码系统 (V2.1 重点升级)
-- ============================================

-- 洗码方案表
CREATE TABLE IF NOT EXISTS commission_schemes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheme_name VARCHAR(50) NOT NULL, -- 普通方案, VIP方案, 至尊方案
  description TEXT,
  settle_type TINYINT NOT NULL DEFAULT 1, -- 1:日结 2:周结 3:月结
  min_valid_bet DECIMAL(12,2) DEFAULT 0.00, -- 最低有效投注门槛
  max_payout DECIMAL(12,2), -- 单次最高返水
  auto_settle TINYINT DEFAULT 0, -- 0:人工审核 1:自动发放
  auto_settle_threshold DECIMAL(12,2) DEFAULT 1000.00, -- 自动发放阈值
  status TINYINT DEFAULT 1, -- 1:启用 0:停用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 洗码比例配置 (差异化游戏类型)
CREATE TABLE IF NOT EXISTS commission_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheme_id INTEGER NOT NULL,
  game_type VARCHAR(20) NOT NULL, -- baccarat, dragon_tiger, roulette, etc.
  commission_rate DECIMAL(6,4) NOT NULL, -- 0.0080 = 0.8%
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scheme_id) REFERENCES commission_schemes(id)
);

-- 洗码结算记录
CREATE TABLE IF NOT EXISTS commission_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  scheme_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  game_type VARCHAR(20),
  total_bet DECIMAL(12,2) DEFAULT 0.00,
  valid_bet DECIMAL(12,2) DEFAULT 0.00,
  commission_rate DECIMAL(6,4) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  status TINYINT DEFAULT 0, -- 0:待审核 1:已发放 2:已拒绝 3:自动发放
  reviewed_by INTEGER, -- admin_id
  reviewed_at DATETIME,
  settled_at DATETIME,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (scheme_id) REFERENCES commission_schemes(id),
  FOREIGN KEY (reviewed_by) REFERENCES admins(id)
);

-- ============================================
-- 7. 荷官与排班管理 (V2.1 新增)
-- ============================================

-- 荷官档案表
CREATE TABLE IF NOT EXISTS dealers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no VARCHAR(20) UNIQUE NOT NULL, -- 工号
  stage_name VARCHAR(50) NOT NULL, -- 艺名
  stage_name_en VARCHAR(50), -- 英文艺名
  real_name VARCHAR(50),
  gender TINYINT, -- 1:男 2:女
  avatar_url VARCHAR(200), -- 头像
  photo_url VARCHAR(200), -- 半身照
  phone VARCHAR(20),
  email VARCHAR(100),
  status TINYINT DEFAULT 1, -- 1:在职 2:休假 3:离职
  rating DECIMAL(3,2) DEFAULT 5.00, -- 评分
  total_shifts INTEGER DEFAULT 0, -- 总班次数
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 排班表
CREATE TABLE IF NOT EXISTS dealer_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  shift_date DATE NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status TINYINT DEFAULT 1, -- 1:已排班 2:进行中 3:已完成 4:已取消
  notes TEXT,
  created_by INTEGER, -- admin_id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealer_id) REFERENCES dealers(id),
  FOREIGN KEY (table_id) REFERENCES game_tables(id),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- ============================================
-- 8. 风险控制表
-- ============================================

-- 风险预警记录
CREATE TABLE IF NOT EXISTS risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type VARCHAR(20) NOT NULL, -- big_bet, arb_suspect, high_win, ip_abnormal, device_abnormal
  severity VARCHAR(10) DEFAULT 'medium', -- low, medium, high, critical
  player_id INTEGER,
  bet_id INTEGER,
  table_id INTEGER,
  alert_data TEXT, -- JSON
  status TINYINT DEFAULT 0, -- 0:待处理 1:已处理 2:已忽略
  handled_by INTEGER, -- admin_id
  handled_at DATETIME,
  handle_action VARCHAR(50), -- lock, limit, kick, observe, ignore
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (bet_id) REFERENCES bets(id),
  FOREIGN KEY (table_id) REFERENCES game_tables(id),
  FOREIGN KEY (handled_by) REFERENCES admins(id)
);

-- 限红配置
CREATE TABLE IF NOT EXISTS limit_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_name VARCHAR(50) NOT NULL, -- 普通限红, VIP限红, 高风险限红
  game_type VARCHAR(20) NOT NULL,
  min_bet DECIMAL(12,2) DEFAULT 10.00,
  max_bet DECIMAL(12,2) DEFAULT 100000.00,
  max_payout DECIMAL(12,2), -- 单注最高派彩
  daily_max_win DECIMAL(12,2), -- 单日最高赢额
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. 内容管理表
-- ============================================

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  announcement_type VARCHAR(20) NOT NULL, -- marquee, popup, banner
  language VARCHAR(10) DEFAULT 'zh-CN', -- zh-CN, en-US, th-TH, vi-VN
  target_audience VARCHAR(20) DEFAULT 'all', -- all, vip, agent
  image_url VARCHAR(200),
  link_url VARCHAR(200),
  display_order INTEGER DEFAULT 0,
  status TINYINT DEFAULT 0, -- 0:草稿 1:已发布 2:已下架
  publish_at DATETIME,
  expire_at DATETIME,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 游戏规则表
CREATE TABLE IF NOT EXISTS game_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_type VARCHAR(20) NOT NULL,
  language VARCHAR(10) DEFAULT 'zh-CN',
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20),
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. 系统配置表
-- ============================================

-- 系统参数表
CREATE TABLE IF NOT EXISTS system_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES admins(id)
);

-- ============================================
-- 创建索引以优化查询性能
-- ============================================

-- 玩家相关索引
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_agent_id ON players(agent_id);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);

-- 代理相关索引
CREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent_path ON agents(agent_path);

-- 财务相关索引
CREATE INDEX IF NOT EXISTS idx_deposits_player_id ON deposits(player_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_player_id ON withdrawals(player_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- 注单相关索引
CREATE INDEX IF NOT EXISTS idx_bets_player_id ON bets(player_id);
CREATE INDEX IF NOT EXISTS idx_bets_table_id ON bets(table_id);
CREATE INDEX IF NOT EXISTS idx_bets_game_round ON bets(game_round);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_bet_at ON bets(bet_at);
CREATE INDEX IF NOT EXISTS idx_bets_bet_amount ON bets(bet_amount);

-- 洗码相关索引
CREATE INDEX IF NOT EXISTS idx_commission_settlements_player_id ON commission_settlements(player_id);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_status ON commission_settlements(status);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_period ON commission_settlements(period_start, period_end);

-- 排班相关索引
CREATE INDEX IF NOT EXISTS idx_dealer_shifts_dealer_id ON dealer_shifts(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_shifts_table_id ON dealer_shifts(table_id);
CREATE INDEX IF NOT EXISTS idx_dealer_shifts_date ON dealer_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_dealer_shifts_time ON dealer_shifts(start_time, end_time);

-- 风险相关索引
CREATE INDEX IF NOT EXISTS idx_risk_alerts_player_id ON risk_alerts(player_id);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_status ON risk_alerts(status);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_type ON risk_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_created_at ON risk_alerts(created_at);

-- 操作日志索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_admin_id ON operation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
