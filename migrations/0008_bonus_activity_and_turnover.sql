-- V2.2.4: 红利活动方案、流水稽查配置、管理员IP白名单绑定

-- 1. 管理员IP白名单绑定表（上级给下级设置）
CREATE TABLE IF NOT EXISTS admin_ip_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,           -- 被绑定的管理员ID
  ip_address TEXT NOT NULL,            -- IP地址或CIDR格式
  description TEXT,                    -- 描述说明
  created_by INTEGER,                  -- 创建人（上级管理员）
  is_active INTEGER DEFAULT 1,         -- 是否启用
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_ip_bindings_admin ON admin_ip_bindings(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_ip_bindings_ip ON admin_ip_bindings(ip_address);

-- 2. 流水稽查配置表
CREATE TABLE IF NOT EXISTS turnover_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_name TEXT NOT NULL,           -- 配置名称
  config_type TEXT NOT NULL,           -- 类型: deposit(存款), bonus(红利), withdrawal(提款)
  turnover_multiple DECIMAL(5,2) DEFAULT 1,  -- 流水倍数
  valid_days INTEGER DEFAULT 30,       -- 有效天数
  game_contribution TEXT,              -- 游戏贡献比例JSON {"baccarat": 100, "dragon_tiger": 100, "sicbo": 50}
  min_bet_amount DECIMAL(15,2) DEFAULT 0,    -- 最低单注金额
  max_bet_amount DECIMAL(15,2),        -- 最高单注金额（NULL表示无限制）
  excluded_games TEXT,                 -- 排除的游戏类型JSON数组
  description TEXT,
  is_default INTEGER DEFAULT 0,        -- 是否默认配置
  status INTEGER DEFAULT 1,            -- 0=禁用, 1=启用
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turnover_configs_type ON turnover_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_turnover_configs_status ON turnover_configs(status);

-- 3. 红利活动方案表
CREATE TABLE IF NOT EXISTS bonus_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_name TEXT NOT NULL,         -- 活动名称
  activity_type TEXT NOT NULL,         -- 类型: signup(注册), first_deposit(首存), reload(续存), birthday(生日), vip(VIP), daily(每日), weekly(每周)
  bonus_type TEXT NOT NULL,            -- 红利形式: fixed(固定金额), percent(百分比), tiered(阶梯)
  bonus_value DECIMAL(15,2),           -- 红利值（固定金额或百分比）
  bonus_tiers TEXT,                    -- 阶梯配置JSON [{"min":100,"max":1000,"value":50},...]
  max_bonus DECIMAL(15,2),             -- 单次最高红利
  min_deposit DECIMAL(15,2),           -- 最低存款要求
  max_deposit DECIMAL(15,2),           -- 最高存款限制
  turnover_config_id INTEGER,          -- 关联的流水稽查配置ID
  auto_dispatch INTEGER DEFAULT 0,     -- 是否自动派发 0=手动, 1=自动
  claim_limit INTEGER DEFAULT 1,       -- 领取次数限制 (0=无限)
  claim_interval TEXT,                 -- 领取间隔: once(仅一次), daily(每天), weekly(每周), monthly(每月)
  vip_levels TEXT,                     -- 适用VIP等级JSON数组 [1,2,3]
  player_tags TEXT,                    -- 适用玩家标签JSON数组
  start_time DATETIME,                 -- 活动开始时间
  end_time DATETIME,                   -- 活动结束时间
  priority INTEGER DEFAULT 100,        -- 优先级（数值越小越优先）
  description TEXT,
  terms_conditions TEXT,               -- 活动条款
  status INTEGER DEFAULT 1,            -- 0=禁用, 1=启用, 2=已结束
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (turnover_config_id) REFERENCES turnover_configs(id)
);

CREATE INDEX IF NOT EXISTS idx_bonus_activities_type ON bonus_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_bonus_activities_status ON bonus_activities(status);
CREATE INDEX IF NOT EXISTS idx_bonus_activities_time ON bonus_activities(start_time, end_time);

-- 4. 红利领取记录表（关联活动和流水）
CREATE TABLE IF NOT EXISTS bonus_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  activity_id INTEGER,                 -- 关联的活动ID
  bonus_record_id INTEGER,             -- 关联的红利记录ID
  turnover_config_id INTEGER,          -- 使用的流水配置ID
  claim_amount DECIMAL(15,2) NOT NULL, -- 领取金额
  deposit_amount DECIMAL(15,2),        -- 触发的存款金额
  required_turnover DECIMAL(15,2),     -- 所需流水
  completed_turnover DECIMAL(15,2) DEFAULT 0, -- 已完成流水
  status INTEGER DEFAULT 0,            -- 0=进行中, 1=已完成, 2=已过期, 3=已取消
  expire_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  FOREIGN KEY (activity_id) REFERENCES bonus_activities(id),
  FOREIGN KEY (bonus_record_id) REFERENCES bonus_records(id),
  FOREIGN KEY (turnover_config_id) REFERENCES turnover_configs(id)
);

CREATE INDEX IF NOT EXISTS idx_bonus_claims_player ON bonus_claims(player_id);
CREATE INDEX IF NOT EXISTS idx_bonus_claims_activity ON bonus_claims(activity_id);
CREATE INDEX IF NOT EXISTS idx_bonus_claims_status ON bonus_claims(status);

-- 5. 更新bonus_records表，添加关联字段
-- 注意：SQLite不支持ALTER TABLE ADD COLUMN IF NOT EXISTS，需要检查后添加
-- 这里我们假设字段不存在，如果已存在会报错但不影响

-- 插入默认流水稽查配置
INSERT INTO turnover_configs (config_name, config_type, turnover_multiple, valid_days, game_contribution, description, is_default, created_by) VALUES
  ('存款标准流水', 'deposit', 1, 30, '{"baccarat":100,"dragon_tiger":100,"sicbo":100,"roulette":100,"bull":100}', '存款默认1倍流水要求', 1, 1),
  ('红利标准流水', 'bonus', 3, 7, '{"baccarat":100,"dragon_tiger":100,"sicbo":50,"roulette":50,"bull":80}', '红利默认3倍流水要求，7天有效', 1, 1),
  ('红利高流水', 'bonus', 5, 14, '{"baccarat":100,"dragon_tiger":100,"sicbo":30,"roulette":30,"bull":50}', '高额红利5倍流水要求，14天有效', 0, 1),
  ('提款审核流水', 'withdrawal', 1, 0, '{"baccarat":100,"dragon_tiger":100,"sicbo":100,"roulette":100,"bull":100}', '提款前需完成1倍存款流水', 1, 1);

-- 插入默认红利活动方案
INSERT INTO bonus_activities (activity_name, activity_type, bonus_type, bonus_value, max_bonus, min_deposit, turnover_config_id, auto_dispatch, claim_limit, claim_interval, description, status, created_by) VALUES
  ('新会员注册礼金', 'signup', 'fixed', 88, 88, 0, 2, 1, 1, 'once', '新注册会员即送88元红利', 1, 1),
  ('首存100%优惠', 'first_deposit', 'percent', 100, 1000, 100, 2, 1, 1, 'once', '首次存款享100%红利，最高1000元', 1, 1),
  ('续存50%优惠', 'reload', 'percent', 50, 500, 200, 2, 0, 0, 'daily', '每日续存享50%红利，最高500元', 1, 1),
  ('生日专属礼金', 'birthday', 'fixed', 188, 188, 0, 2, 1, 1, 'once', '生日当天领取188元礼金', 1, 1),
  ('VIP月度回馈', 'vip', 'tiered', NULL, 10000, 0, 3, 0, 1, 'monthly', 'VIP会员月度回馈，根据等级享不同红利', 1, 1);

-- 更新VIP月度回馈的阶梯配置
UPDATE bonus_activities SET bonus_tiers = '[{"vip":1,"value":100},{"vip":2,"value":300},{"vip":3,"value":500},{"vip":4,"value":1000},{"vip":5,"value":2000}]' WHERE activity_name = 'VIP月度回馈';

-- 插入测试管理员IP绑定
INSERT INTO admin_ip_bindings (admin_id, ip_address, description, created_by, is_active) VALUES
  (2, '192.168.1.0/24', '财务部门内网', 1, 1),
  (3, '10.0.0.0/8', '风控部门内网', 1, 1),
  (4, '0.0.0.0/0', '运营专员允许所有IP', 1, 1);
