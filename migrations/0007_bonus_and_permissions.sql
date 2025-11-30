-- V2.2.3: 红利系统表和权限细化
-- 创建红利记录表
CREATE TABLE IF NOT EXISTS bonus_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  bonus_type TEXT NOT NULL DEFAULT 'manual',  -- signup, deposit, birthday, vip, activity, manual
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  turnover_multiple DECIMAL(5,2) DEFAULT 1,
  required_turnover DECIMAL(15,2) DEFAULT 0,
  completed_turnover DECIMAL(15,2) DEFAULT 0,
  status INTEGER DEFAULT 0,  -- 0=待审核, 1=已发放, 2=已完成, 3=已过期, 4=已取消
  expire_at DATETIME,
  remark TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 创建红利记录索引
CREATE INDEX IF NOT EXISTS idx_bonus_records_player ON bonus_records(player_id);
CREATE INDEX IF NOT EXISTS idx_bonus_records_type ON bonus_records(bonus_type);
CREATE INDEX IF NOT EXISTS idx_bonus_records_status ON bonus_records(status);
CREATE INDEX IF NOT EXISTS idx_bonus_records_created ON bonus_records(created_at);

-- 插入默认红利测试数据
INSERT INTO bonus_records (player_id, bonus_type, amount, turnover_multiple, required_turnover, completed_turnover, status, expire_at, remark) VALUES
  (1, 'signup', 100, 3, 300, 450, 2, datetime('now', '+7 days'), '新会员注册礼金'),
  (2, 'deposit', 500, 5, 2500, 1200, 1, datetime('now', '+14 days'), '首存100%红利'),
  (3, 'birthday', 200, 1, 200, 0, 1, datetime('now', '+7 days'), '生日特惠礼金'),
  (1, 'vip', 1000, 3, 3000, 2800, 1, datetime('now', '+30 days'), 'VIP月度回馈'),
  (4, 'activity', 300, 2, 600, 0, 0, datetime('now', '+3 days'), '端午节活动奖励'),
  (5, 'manual', 150, 1, 150, 150, 2, datetime('now', '+7 days'), '客服补偿处理');

-- 权限定义表（用于存储可分配的权限列表）
CREATE TABLE IF NOT EXISTS permission_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_key TEXT NOT NULL UNIQUE,
  permission_name TEXT NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  parent_key TEXT,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入标准权限定义（细化到子功能）
INSERT OR REPLACE INTO permission_definitions (permission_key, permission_name, category, category_name, parent_key, sort_order, description) VALUES
  -- 仪表盘
  ('dashboard', '仪表盘', 'dashboard', '仪表盘', NULL, 100, '仪表盘主模块'),
  ('dashboard:read', '查看仪表盘', 'dashboard', '仪表盘', 'dashboard', 101, '查看仪表盘数据'),
  ('dashboard:statistics', '统计数据', 'dashboard', '仪表盘', 'dashboard', 102, '查看详细统计'),
  ('dashboard:charts', '图表分析', 'dashboard', '仪表盘', 'dashboard', 103, '查看趋势图表'),
  
  -- 会员管理
  ('player', '会员管理', 'player', '会员管理', NULL, 200, '会员管理主模块'),
  ('player:read', '查看会员', 'player', '会员管理', 'player', 201, '查看会员列表和详情'),
  ('player:create', '新增会员', 'player', '会员管理', 'player', 202, '创建新会员'),
  ('player:edit', '编辑会员', 'player', '会员管理', 'player', 203, '修改会员信息'),
  ('player:freeze', '冻结会员', 'player', '会员管理', 'player', 204, '冻结/解冻会员账号'),
  ('player:balance', '余额调整', 'player', '会员管理', 'player', 205, '调整会员余额'),
  ('player:tags', '标签管理', 'player', '会员管理', 'player', 206, '管理会员标签'),
  ('player:export', '导出会员', 'player', '会员管理', 'player', 207, '导出会员数据'),
  ('player:online', '在线监控', 'player', '会员管理', 'player', 208, '查看在线会员'),
  
  -- 代理管理
  ('agent', '代理管理', 'agent', '代理管理', NULL, 300, '代理管理主模块'),
  ('agent:read', '查看代理', 'agent', '代理管理', 'agent', 301, '查看代理列表和详情'),
  ('agent:create', '新增代理', 'agent', '代理管理', 'agent', 302, '创建新代理'),
  ('agent:edit', '编辑代理', 'agent', '代理管理', 'agent', 303, '修改代理信息'),
  ('agent:manage', '代理管理', 'agent', '代理管理', 'agent', 304, '管理代理状态'),
  ('agent:commission', '佣金设置', 'agent', '代理管理', 'agent', 305, '设置代理佣金'),
  ('agent:report', '代理报表', 'agent', '代理管理', 'agent', 306, '查看代理业绩报表'),
  
  -- 投注记录
  ('bet', '投注记录', 'bet', '投注记录', NULL, 400, '投注记录主模块'),
  ('bet:read', '查看投注', 'bet', '投注记录', 'bet', 401, '查看投注记录'),
  ('bet:detail', '投注详情', 'bet', '投注记录', 'bet', 402, '查看投注详细信息'),
  ('bet:export', '导出投注', 'bet', '投注记录', 'bet', 403, '导出投注记录'),
  ('bet:analysis', '投注分析', 'bet', '投注记录', 'bet', 404, '投注数据分析'),
  
  -- 财务管理
  ('finance', '财务管理', 'finance', '财务管理', NULL, 500, '财务管理主模块'),
  ('finance:read', '查看财务', 'finance', '财务管理', 'finance', 501, '查看财务概览'),
  ('finance:deposit', '存款管理', 'finance', '财务管理', 'finance', 502, '管理存款申请'),
  ('finance:withdrawal', '提款管理', 'finance', '财务管理', 'finance', 503, '管理提款申请'),
  ('finance:transaction', '交易记录', 'finance', '财务管理', 'finance', 504, '查看交易流水'),
  ('finance:payment', '支付方式', 'finance', '财务管理', 'finance', 505, '管理支付渠道'),
  ('finance:transfer', '转账记录', 'finance', '财务管理', 'finance', 506, '查看转账记录'),
  ('finance:fee', '手续费设置', 'finance', '财务管理', 'finance', 507, '设置转账手续费'),
  ('finance:adjustment', '资金调整', 'finance', '财务管理', 'finance', 508, '人工调整资金'),
  ('finance:export', '财务导出', 'finance', '财务管理', 'finance', 509, '导出财务数据'),
  
  -- 红利与洗码
  ('commission', '红利与洗码', 'commission', '红利与洗码', NULL, 600, '红利与洗码主模块'),
  ('commission:read', '查看洗码', 'commission', '红利与洗码', 'commission', 601, '查看洗码方案'),
  ('commission:scheme', '方案管理', 'commission', '红利与洗码', 'commission', 602, '管理洗码方案'),
  ('commission:review', '审核洗码', 'commission', '红利与洗码', 'commission', 603, '审核洗码申请'),
  ('commission:bonus', '红利派发', 'commission', '红利与洗码', 'commission', 604, '派发会员红利'),
  ('commission:turnover', '流水稽查', 'commission', '红利与洗码', 'commission', 605, '流水稽核管理'),
  ('commission:export', '洗码导出', 'commission', '红利与洗码', 'commission', 606, '导出洗码数据'),
  
  -- 风险控端
  ('risk', '风险控端', 'risk', '风险控端', NULL, 700, '风险控端主模块'),
  ('risk:read', '查看风控', 'risk', '风险控端', 'risk', 701, '查看风控数据'),
  ('risk:alert', '预警处理', 'risk', '风险控端', 'risk', 702, '处理风险预警'),
  ('risk:limit', '限红配置', 'risk', '风险控端', 'risk', 703, '配置投注限红'),
  ('risk:rule', '规则配置', 'risk', '风险控端', 'risk', 704, '配置风控规则'),
  ('risk:ip', 'IP分析', 'risk', '风险控端', 'risk', 705, 'IP地址分析'),
  ('risk:device', '设备分析', 'risk', '风险控端', 'risk', 706, '设备指纹分析'),
  
  -- 现场运营
  ('studio', '现场运营', 'studio', '现场运营', NULL, 800, '现场运营主模块'),
  ('studio:read', '查看运营', 'studio', '现场运营', 'studio', 801, '查看运营数据'),
  ('studio:table', '桌台管理', 'studio', '现场运营', 'studio', 802, '管理游戏桌台'),
  ('studio:dealer', '荷官管理', 'studio', '现场运营', 'studio', 803, '管理荷官信息'),
  ('studio:shift', '排班管理', 'studio', '现场运营', 'studio', 804, '管理荷官排班'),
  ('studio:stream', '视频流管理', 'studio', '现场运营', 'studio', 805, '管理视频流状态'),
  
  -- 内容管理
  ('content', '内容管理', 'content', '内容管理', NULL, 900, '内容管理主模块'),
  ('content:read', '查看内容', 'content', '内容管理', 'content', 901, '查看内容列表'),
  ('content:banner', '轮播图管理', 'content', '内容管理', 'content', 902, '管理轮播图'),
  ('content:announcement', '公告管理', 'content', '内容管理', 'content', 903, '管理系统公告'),
  ('content:message', '消息管理', 'content', '内容管理', 'content', 904, '管理会员消息'),
  
  -- 报表中心
  ('report', '报表中心', 'report', '报表中心', NULL, 1000, '报表中心主模块'),
  ('report:read', '查看报表', 'report', '报表中心', 'report', 1001, '查看基础报表'),
  ('report:daily', '每日报表', 'report', '报表中心', 'report', 1002, '查看每日汇总'),
  ('report:shareholder', '股东报表', 'report', '报表中心', 'report', 1003, '查看股东报表'),
  ('report:agent', '代理报表', 'report', '报表中心', 'report', 1004, '查看代理报表'),
  ('report:player', '会员报表', 'report', '报表中心', 'report', 1005, '查看会员报表'),
  ('report:game', '游戏报表', 'report', '报表中心', 'report', 1006, '查看游戏统计'),
  ('report:commission', '洗码报表', 'report', '报表中心', 'report', 1007, '查看洗码报表'),
  ('report:transfer', '转账报表', 'report', '报表中心', 'report', 1008, '查看转账报表'),
  ('report:export', '报表导出', 'report', '报表中心', 'report', 1009, '导出报表数据'),
  
  -- 系统设置
  ('system', '系统设置', 'system', '系统设置', NULL, 1100, '系统设置主模块'),
  ('system:read', '查看设置', 'system', '系统设置', 'system', 1101, '查看系统设置'),
  ('system:profile', '个人信息', 'system', '系统设置', 'system', 1102, '管理个人信息'),
  ('system:password', '修改密码', 'system', '系统设置', 'system', 1103, '修改登录密码'),
  ('system:2fa', '2FA设置', 'system', '系统设置', 'system', 1104, '两步验证设置'),
  ('system:whitelist', 'IP白名单', 'system', '系统设置', 'system', 1105, '管理IP白名单'),
  ('system:admin', '管理员管理', 'system', '系统设置', 'system', 1106, '管理管理员账号'),
  ('system:role', '角色管理', 'system', '系统设置', 'system', 1107, '管理角色权限'),
  ('system:log', '操作日志', 'system', '系统设置', 'system', 1108, '查看操作日志'),
  ('system:login_log', '登录日志', 'system', '系统设置', 'system', 1109, '查看登录日志');

-- 更新默认角色权限为细化权限
UPDATE admin_roles SET permissions = '["*"]' WHERE role_name = 'super_admin';
UPDATE admin_roles SET permissions = '["dashboard:read","dashboard:statistics","player:read","player:tags","finance:read","finance:deposit","finance:withdrawal","finance:transaction","finance:payment","finance:transfer","finance:fee","finance:adjustment","finance:export","commission:read","commission:scheme","commission:review","commission:bonus","commission:turnover","commission:export","report:read","report:daily","report:agent","report:commission"]' WHERE role_name = 'finance';
UPDATE admin_roles SET permissions = '["dashboard:read","player:read","player:freeze","bet:read","bet:detail","bet:analysis","risk:read","risk:alert","risk:limit","risk:rule","risk:ip","risk:device"]' WHERE role_name = 'risk_officer';
UPDATE admin_roles SET permissions = '["dashboard:read","dashboard:statistics","dashboard:charts","player:read","player:create","player:edit","player:tags","player:export","player:online","agent:read","agent:report","bet:read","bet:detail","bet:export","studio:read","studio:table","studio:dealer","studio:shift","content:read","content:banner","content:announcement","content:message","report:read","report:daily","report:player","report:game","system:read","system:profile","system:password","system:log"]' WHERE role_name = 'operator';
UPDATE admin_roles SET permissions = '["dashboard:read","player:read","player:tags","finance:deposit","finance:adjustment","content:message"]' WHERE role_name = 'customer_service';
