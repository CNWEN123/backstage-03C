-- ============================================
-- 真人荷官视讯后台管理系统 V2.1 升级迁移
-- 基于功能规格说明书全面升级
-- ============================================

-- ============================================
-- 1. 升级管理员表 - 添加 RBAC 支持
-- ============================================

-- 角色权限表 (RBAC)
CREATE TABLE IF NOT EXISTS admin_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name VARCHAR(50) UNIQUE NOT NULL, -- super_admin, finance, risk_officer, operator, customer_service
  role_display_name VARCHAR(50) NOT NULL, -- 显示名称
  permissions TEXT NOT NULL, -- JSON array: ['player:read', 'player:write', 'finance:audit']
  description TEXT,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 管理员角色关联表
CREATE TABLE IF NOT EXISTS admin_role_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id),
  UNIQUE(admin_id, role_id)
);

-- ============================================
-- 2. 升级玩家表 - 添加LTV和更多字段
-- ============================================

-- 玩家在线状态表 (实时监控)
CREATE TABLE IF NOT EXISTS player_online_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER UNIQUE NOT NULL,
  is_online TINYINT DEFAULT 0,
  current_table_id INTEGER,
  current_game_type VARCHAR(20),
  login_time DATETIME,
  last_active_time DATETIME,
  session_id VARCHAR(100),
  ip_address VARCHAR(50),
  device_info TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (current_table_id) REFERENCES game_tables(id)
);

-- 玩家银行卡表
CREATE TABLE IF NOT EXISTS player_bank_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  bank_name VARCHAR(50) NOT NULL,
  bank_account VARCHAR(50) NOT NULL,
  account_name VARCHAR(50) NOT NULL,
  is_default TINYINT DEFAULT 0,
  status TINYINT DEFAULT 1, -- 1:正常 0:禁用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 玩家限红配置表 (个性化限红)
CREATE TABLE IF NOT EXISTS player_limit_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_type VARCHAR(20) NOT NULL,
  limit_config_id INTEGER, -- 关联限红组
  custom_min_bet DECIMAL(12,2),
  custom_max_bet DECIMAL(12,2),
  daily_max_win DECIMAL(12,2),
  daily_max_loss DECIMAL(12,2),
  effective_from DATETIME,
  effective_to DATETIME,
  reason TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (limit_config_id) REFERENCES limit_configs(id),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 玩家代理转移记录表
CREATE TABLE IF NOT EXISTS player_agent_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  from_agent_id INTEGER,
  to_agent_id INTEGER NOT NULL,
  reason TEXT,
  transferred_by INTEGER NOT NULL, -- admin_id
  transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (from_agent_id) REFERENCES agents(id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(id),
  FOREIGN KEY (transferred_by) REFERENCES admins(id)
);

-- ============================================
-- 3. 升级财务表 - 添加流水稽核
-- ============================================

-- 存款补单记录表
CREATE TABLE IF NOT EXISTS deposit_supplements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_deposit_id INTEGER,
  player_id INTEGER NOT NULL,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20),
  payment_reference VARCHAR(100), -- 支付凭证号
  supplement_reason TEXT NOT NULL,
  status TINYINT DEFAULT 0, -- 0:待审核 1:已通过 2:已拒绝
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  remark TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (original_deposit_id) REFERENCES deposits(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (reviewed_by) REFERENCES admins(id),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 流水稽核记录表
CREATE TABLE IF NOT EXISTS turnover_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  withdrawal_id INTEGER,
  deposit_amount DECIMAL(12,2) NOT NULL, -- 关联存款金额
  required_multiple DECIMAL(5,2) DEFAULT 1.00, -- 流水倍数要求
  required_turnover DECIMAL(12,2) NOT NULL, -- 需要的流水
  actual_turnover DECIMAL(12,2) DEFAULT 0.00, -- 实际流水
  is_met TINYINT DEFAULT 0, -- 0:未达标 1:已达标
  audit_period_start DATETIME,
  audit_period_end DATETIME,
  audit_result TEXT, -- JSON: 详细的稽核结果
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id)
);

-- ============================================
-- 4. 升级注单表 - 添加更多字段
-- ============================================

-- 高赔率注单监控表 (三宝/特殊注单)
CREATE TABLE IF NOT EXISTS high_odds_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  bet_type VARCHAR(50) NOT NULL, -- pair, tie, three_of_kind, etc.
  odds DECIMAL(8,2) NOT NULL,
  bet_amount DECIMAL(12,2) NOT NULL,
  potential_payout DECIMAL(12,2) NOT NULL,
  is_flagged TINYINT DEFAULT 0, -- 是否标记为可疑
  flag_reason TEXT,
  handled_by INTEGER,
  handled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bet_id) REFERENCES bets(id),
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (handled_by) REFERENCES admins(id)
);

-- ============================================
-- 5. 升级风控表 - IP关联分析
-- ============================================

-- IP关联分析表
CREATE TABLE IF NOT EXISTS ip_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address VARCHAR(50) NOT NULL,
  player_ids TEXT NOT NULL, -- JSON array of player_ids
  player_count INTEGER DEFAULT 1,
  device_fingerprints TEXT, -- JSON array of device fingerprints
  risk_score INTEGER DEFAULT 0, -- 0-100
  is_suspicious TINYINT DEFAULT 0,
  analysis_result TEXT, -- JSON
  last_analysis_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 设备指纹关联表
CREATE TABLE IF NOT EXISTS device_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_fingerprint VARCHAR(100) NOT NULL,
  player_ids TEXT NOT NULL, -- JSON array
  player_count INTEGER DEFAULT 1,
  ip_addresses TEXT, -- JSON array
  risk_score INTEGER DEFAULT 0,
  is_suspicious TINYINT DEFAULT 0,
  analysis_result TEXT,
  last_analysis_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 风控规则表
CREATE TABLE IF NOT EXISTS risk_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- big_bet, consecutive_win, ip_multi_account, arb_suspect
  rule_condition TEXT NOT NULL, -- JSON: 规则条件
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  action VARCHAR(50) DEFAULT 'alert', -- alert, limit, lock, observe
  is_enabled TINYINT DEFAULT 1,
  description TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 限红组表
CREATE TABLE IF NOT EXISTS limit_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name VARCHAR(50) NOT NULL, -- A组, B组, VIP组, 高风险组
  description TEXT,
  is_default TINYINT DEFAULT 0,
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 限红组配置详情
CREATE TABLE IF NOT EXISTS limit_group_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  game_type VARCHAR(20) NOT NULL,
  bet_type VARCHAR(50), -- banker, player, tie, pair, etc.
  min_bet DECIMAL(12,2) DEFAULT 10.00,
  max_bet DECIMAL(12,2) DEFAULT 100000.00,
  max_payout DECIMAL(12,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES limit_groups(id)
);

-- ============================================
-- 6. 升级报表相关表
-- ============================================

-- 日结报表表 (缓存)
CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date DATE UNIQUE NOT NULL,
  total_bet_amount DECIMAL(14,2) DEFAULT 0.00,
  total_bet_count INTEGER DEFAULT 0,
  total_valid_bet DECIMAL(14,2) DEFAULT 0.00,
  total_payout DECIMAL(14,2) DEFAULT 0.00,
  platform_profit DECIMAL(14,2) DEFAULT 0.00,
  total_deposit DECIMAL(14,2) DEFAULT 0.00,
  deposit_count INTEGER DEFAULT 0,
  total_withdrawal DECIMAL(14,2) DEFAULT 0.00,
  withdrawal_count INTEGER DEFAULT 0,
  new_players INTEGER DEFAULT 0,
  active_players INTEGER DEFAULT 0,
  total_commission DECIMAL(14,2) DEFAULT 0.00,
  game_breakdown TEXT, -- JSON: 按游戏类型分解
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 代理业绩报表
CREATE TABLE IF NOT EXISTS agent_performance_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  report_period VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_players INTEGER DEFAULT 0,
  active_players INTEGER DEFAULT 0,
  new_players INTEGER DEFAULT 0,
  total_bet DECIMAL(14,2) DEFAULT 0.00,
  total_valid_bet DECIMAL(14,2) DEFAULT 0.00,
  player_profit_loss DECIMAL(14,2) DEFAULT 0.00,
  company_profit DECIMAL(14,2) DEFAULT 0.00,
  commission_earned DECIMAL(14,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  UNIQUE(agent_id, period_start, period_end)
);

-- ============================================
-- 7. 升级内容管理表
-- ============================================

-- 轮播图表
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(100) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  link_type VARCHAR(20) DEFAULT 'none', -- none, internal, external
  position VARCHAR(20) DEFAULT 'home', -- home, game_lobby, deposit
  display_order INTEGER DEFAULT 0,
  target_audience VARCHAR(20) DEFAULT 'all', -- all, vip, agent
  start_time DATETIME,
  end_time DATETIME,
  status TINYINT DEFAULT 0, -- 0:草稿 1:已发布 2:已下架
  click_count INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- ============================================
-- 8. 升级现场运营表 - 排班冲突检测
-- ============================================

-- 排班冲突记录表
CREATE TABLE IF NOT EXISTS shift_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  conflict_type VARCHAR(50) NOT NULL, -- dealer_overlap, table_overlap
  conflicting_shift_id INTEGER,
  conflict_detail TEXT, -- JSON
  is_resolved TINYINT DEFAULT 0,
  resolved_by INTEGER,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES dealer_shifts(id),
  FOREIGN KEY (conflicting_shift_id) REFERENCES dealer_shifts(id),
  FOREIGN KEY (resolved_by) REFERENCES admins(id)
);

-- 荷官评分记录表
CREATE TABLE IF NOT EXISTS dealer_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL,
  rating_type VARCHAR(20) NOT NULL, -- performance, appearance, service
  rating_score DECIMAL(3,2) NOT NULL, -- 1.00 - 5.00
  rating_period_start DATE,
  rating_period_end DATE,
  comments TEXT,
  rated_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dealer_id) REFERENCES dealers(id),
  FOREIGN KEY (rated_by) REFERENCES admins(id)
);

-- ============================================
-- 9. 系统配置扩展
-- ============================================

-- 定时任务记录表
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name VARCHAR(100) NOT NULL,
  task_type VARCHAR(50) NOT NULL, -- commission_calculate, report_generate, risk_scan
  cron_expression VARCHAR(50),
  last_run_at DATETIME,
  next_run_at DATETIME,
  last_run_status VARCHAR(20), -- success, failed, running
  last_run_result TEXT, -- JSON
  is_enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 数据导出任务表
CREATE TABLE IF NOT EXISTS export_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name VARCHAR(100) NOT NULL,
  export_type VARCHAR(50) NOT NULL, -- bets, players, transactions, report
  query_params TEXT, -- JSON: 查询参数
  file_format VARCHAR(20) DEFAULT 'xlsx', -- xlsx, csv
  file_url VARCHAR(500),
  file_size INTEGER,
  record_count INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  requested_by INTEGER NOT NULL,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES admins(id)
);

-- ============================================
-- 创建新索引
-- ============================================

-- 在线状态索引
CREATE INDEX IF NOT EXISTS idx_player_online_status_player_id ON player_online_status(player_id);
CREATE INDEX IF NOT EXISTS idx_player_online_status_is_online ON player_online_status(is_online);

-- IP分析索引
CREATE INDEX IF NOT EXISTS idx_ip_analysis_ip ON ip_analysis(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_analysis_suspicious ON ip_analysis(is_suspicious);

-- 高赔率注单索引
CREATE INDEX IF NOT EXISTS idx_high_odds_bets_bet_id ON high_odds_bets(bet_id);
CREATE INDEX IF NOT EXISTS idx_high_odds_bets_player_id ON high_odds_bets(player_id);

-- 日结报表索引
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- 代理业绩索引
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_period ON agent_performance_reports(period_start, period_end);

-- 轮播图索引
CREATE INDEX IF NOT EXISTS idx_banners_status ON banners(status);
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position);

-- 排班冲突索引
CREATE INDEX IF NOT EXISTS idx_shift_conflicts_shift_id ON shift_conflicts(shift_id);

-- 导出任务索引
CREATE INDEX IF NOT EXISTS idx_export_tasks_status ON export_tasks(status);
CREATE INDEX IF NOT EXISTS idx_export_tasks_requested_by ON export_tasks(requested_by);
