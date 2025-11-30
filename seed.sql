-- 真人荷官视讯后台管理系统 V2.1 - 完整测试数据
-- 创建时间: 2025-11-29

-- ============================================
-- 1. 管理员数据
-- ============================================
-- 密码说明: admin/admin888, finance01/finance123, risk01/risk123, operator01/operator123
INSERT OR IGNORE INTO admins (id, username, password_hash, real_name, role, email, status) VALUES
(1, 'admin', 'f2842a576a3fe088bcc41137c06ea1c2d1e26f1e95ceeb24f5def9dcb3330821', '超级管理员', 'super_admin', 'admin@casino.com', 1),
(2, 'finance01', 'cd38b220d7629013340d1185404986a187008db019dbfa6fc563e4794b4f2a73', '财务主管', 'finance', 'finance@casino.com', 1),
(3, 'risk01', '3bb82d3c71693f8efe221dd075cd2ad19217c3803c4bc1ce45ae4709e48ba339', '风控专员', 'risk_officer', 'risk@casino.com', 1),
(4, 'operator01', '59c465c74292226c7468b328eed25d0e832d56eb8e900baa70cdf0d7e0829e73', '运营专员', 'operator', 'operator@casino.com', 1);

-- ============================================
-- 2. 代理数据 (层级结构)
-- ============================================
INSERT OR IGNORE INTO agents (id, username, password_hash, agent_level, parent_id, agent_path, profit_share, commission_rate, balance, status) VALUES
-- 股东层级
(1, 'shareholder_a', 'pass123', 1, NULL, '/1/', 60.00, 0.0120, 500000.00, 1),
(2, 'shareholder_b', 'pass123', 1, NULL, '/2/', 55.00, 0.0100, 380000.00, 1),
-- 总代层级
(3, 'general_a1', 'pass123', 2, 1, '/1/3/', 45.00, 0.0090, 120000.00, 1),
(4, 'general_a2', 'pass123', 2, 1, '/1/4/', 40.00, 0.0085, 85000.00, 1),
(5, 'general_b1', 'pass123', 2, 2, '/2/5/', 42.00, 0.0088, 95000.00, 1),
-- 代理层级
(6, 'agent_a1_01', 'pass123', 3, 3, '/1/3/6/', 30.00, 0.0070, 45000.00, 1),
(7, 'agent_a1_02', 'pass123', 3, 3, '/1/3/7/', 28.00, 0.0065, 32000.00, 1),
(8, 'agent_a2_01', 'pass123', 3, 4, '/1/4/8/', 32.00, 0.0072, 28000.00, 1),
(9, 'agent_b1_01', 'pass123', 3, 5, '/2/5/9/', 35.00, 0.0075, 55000.00, 1),
(10, 'agent_b1_02', 'pass123', 3, 5, '/2/5/10/', 30.00, 0.0068, 18000.00, 2);

-- ============================================
-- 3. 洗码方案
-- ============================================
INSERT OR IGNORE INTO commission_schemes (id, scheme_name, description, settle_type, min_valid_bet, max_payout, auto_settle, auto_settle_threshold, status) VALUES
(1, '普通玩家方案', '适用于普通会员，基础返水比例', 1, 1000.00, 10000.00, 1, 500.00, 1),
(2, 'VIP会员方案', '适用于VIP会员，提升返水比例', 1, 500.00, 50000.00, 1, 2000.00, 1),
(3, '至尊VIP方案', '适用于至尊VIP，顶级返水比例', 2, 0.00, 100000.00, 0, NULL, 1),
(4, '代理专属方案', '代理下线专属方案', 3, 5000.00, 200000.00, 0, NULL, 1);

-- 洗码比例配置
INSERT OR IGNORE INTO commission_rates (scheme_id, game_type, commission_rate) VALUES
-- 普通方案
(1, 'baccarat', 0.0050),
(1, 'dragon_tiger', 0.0055),
(1, 'roulette', 0.0045),
(1, 'sicbo', 0.0048),
(1, 'bull_bull', 0.0060),
-- VIP方案
(2, 'baccarat', 0.0080),
(2, 'dragon_tiger', 0.0085),
(2, 'roulette', 0.0070),
(2, 'sicbo', 0.0075),
(2, 'bull_bull', 0.0090),
-- 至尊VIP方案
(3, 'baccarat', 0.0120),
(3, 'dragon_tiger', 0.0125),
(3, 'roulette', 0.0100),
(3, 'sicbo', 0.0110),
(3, 'bull_bull', 0.0130);

-- ============================================
-- 4. 玩家数据
-- ============================================
INSERT OR IGNORE INTO players (id, username, password_hash, nickname, real_name, balance, status, agent_id, vip_level, kyc_status, phone, email, commission_scheme_id, created_at) VALUES
(1, 'player001', 'pass123', '赌神', '张伟', 158000.00, 1, 6, 5, 1, '13800138001', 'player001@mail.com', 2, datetime('now', '-30 days')),
(2, 'player002', 'pass123', '大富翁', '李明', 89500.00, 1, 6, 4, 1, '13800138002', 'player002@mail.com', 2, datetime('now', '-28 days')),
(3, 'player003', 'pass123', '幸运星', '王芳', 45200.00, 1, 7, 3, 1, '13800138003', 'player003@mail.com', 1, datetime('now', '-25 days')),
(4, 'player004', 'pass123', '金手指', '刘洋', 23800.00, 1, 7, 2, 0, '13800138004', 'player004@mail.com', 1, datetime('now', '-22 days')),
(5, 'player005', 'pass123', '豪客', '陈静', 320000.00, 1, 8, 6, 1, '13800138005', 'player005@mail.com', 3, datetime('now', '-20 days')),
(6, 'player006', 'pass123', '小赌怡情', '赵强', 12500.00, 1, 8, 1, 0, '13800138006', 'player006@mail.com', 1, datetime('now', '-18 days')),
(7, 'player007', 'pass123', '百胜客', '孙丽', 67800.00, 2, 9, 3, 1, '13800138007', 'player007@mail.com', 1, datetime('now', '-15 days')),
(8, 'player008', 'pass123', '大佬', '周杰', 95600.00, 1, 9, 4, 1, '13800138008', 'player008@mail.com', 2, datetime('now', '-12 days')),
(9, 'player009', 'pass123', '财神爷', '吴敏', 8900.00, 1, 10, 1, 0, '13800138009', 'player009@mail.com', 1, datetime('now', '-10 days')),
(10, 'player010', 'pass123', '常胜将军', '郑华', 178000.00, 1, 6, 5, 1, '13800138010', 'player010@mail.com', 2, datetime('now', '-8 days')),
(11, 'player011', 'pass123', '小白', '黄磊', 5600.00, 3, 7, 0, 0, '13800138011', 'player011@mail.com', 1, datetime('now', '-5 days')),
(12, 'player012', 'pass123', '老玩家', '杨帆', 42300.00, 1, 8, 2, 1, '13800138012', 'player012@mail.com', 1, datetime('now', '-3 days')),
(13, 'player013', 'pass123', '新手', '徐明', 15000.00, 1, 9, 1, 0, '13800138013', 'player013@mail.com', 1, datetime('now', '-2 days')),
(14, 'player014', 'pass123', 'VIP大佬', '林涛', 450000.00, 1, 6, 7, 1, '13800138014', 'player014@mail.com', 3, datetime('now', '-1 day')),
(15, 'player015', 'pass123', '新注册', '何雪', 10000.00, 1, 7, 0, 0, '13800138015', 'player015@mail.com', 1, datetime('now'));

-- 玩家标签
INSERT OR IGNORE INTO player_tags (player_id, tag, added_by) VALUES
(1, 'VIP', 1),
(1, '高净值', 1),
(5, 'VIP', 1),
(5, '高净值', 1),
(5, '优质客户', 2),
(7, '高风险', 3),
(7, '套利嫌疑', 3),
(10, 'VIP', 1),
(14, '至尊VIP', 1),
(14, '高净值', 1);

-- ============================================
-- 5. 荷官数据
-- ============================================
INSERT OR IGNORE INTO dealers (id, employee_no, stage_name, stage_name_en, real_name, gender, status, rating, total_shifts) VALUES
(1, 'DL001', '小美', 'Bella', '张美丽', 2, 1, 4.95, 156),
(2, 'DL002', '小琳', 'Lynn', '李琳琳', 2, 1, 4.88, 142),
(3, 'DL003', '小雪', 'Snow', '王雪', 2, 1, 4.92, 168),
(4, 'DL004', '小萌', 'Mona', '刘萌萌', 2, 1, 4.78, 98),
(5, 'DL005', '小敏', 'Mindy', '陈敏', 2, 1, 4.85, 124),
(6, 'DL006', '小婷', 'Tina', '赵婷婷', 2, 2, 4.72, 89),
(7, 'DL007', '阿杰', 'Jack', '孙杰', 1, 1, 4.80, 112),
(8, 'DL008', '小丽', 'Lily', '周丽', 2, 1, 4.90, 178),
(9, 'DL009', '小娜', 'Nina', '吴娜', 2, 3, 4.65, 45),
(10, 'DL010', '小薇', 'Vivian', '郑薇', 2, 1, 4.88, 135);

-- ============================================
-- 6. 游戏桌台数据
-- ============================================
INSERT OR IGNORE INTO game_tables (id, table_code, game_type, table_name, min_bet, max_bet, limit_group, status, current_dealer_id) VALUES
(1, 'BAC-001', 'baccarat', '百家乐A厅', 100.00, 100000.00, 'A组', 1, 1),
(2, 'BAC-002', 'baccarat', '百家乐B厅', 50.00, 50000.00, 'B组', 1, 2),
(3, 'BAC-003', 'baccarat', '百家乐VIP厅', 500.00, 500000.00, 'VIP组', 1, 3),
(4, 'DT-001', 'dragon_tiger', '龙虎A厅', 50.00, 50000.00, 'A组', 1, 4),
(5, 'DT-002', 'dragon_tiger', '龙虎B厅', 20.00, 20000.00, 'B组', 1, 5),
(6, 'ROU-001', 'roulette', '轮盘经典厅', 10.00, 10000.00, 'A组', 1, 7),
(7, 'SIC-001', 'sicbo', '骰宝A厅', 20.00, 30000.00, 'A组', 1, 8),
(8, 'BUL-001', 'bull_bull', '牛牛A厅', 50.00, 50000.00, 'A组', 0, NULL),
(9, 'BAC-004', 'baccarat', '百家乐快速厅', 20.00, 20000.00, 'B组', 1, 10),
(10, 'DT-003', 'dragon_tiger', '龙虎VIP厅', 200.00, 200000.00, 'VIP组', 1, NULL);

-- ============================================
-- 7. 排班数据
-- ============================================
INSERT OR IGNORE INTO dealer_shifts (dealer_id, table_id, shift_date, start_time, end_time, status, created_by) VALUES
(1, 1, DATE('now'), datetime('now', 'start of day', '+8 hours'), datetime('now', 'start of day', '+16 hours'), 2, 1),
(2, 2, DATE('now'), datetime('now', 'start of day', '+8 hours'), datetime('now', 'start of day', '+16 hours'), 2, 1),
(3, 3, DATE('now'), datetime('now', 'start of day', '+8 hours'), datetime('now', 'start of day', '+16 hours'), 2, 1),
(4, 4, DATE('now'), datetime('now', 'start of day', '+10 hours'), datetime('now', 'start of day', '+18 hours'), 2, 1),
(5, 5, DATE('now'), datetime('now', 'start of day', '+10 hours'), datetime('now', 'start of day', '+18 hours'), 2, 1),
(7, 6, DATE('now'), datetime('now', 'start of day', '+12 hours'), datetime('now', 'start of day', '+20 hours'), 1, 1),
(8, 7, DATE('now'), datetime('now', 'start of day', '+12 hours'), datetime('now', 'start of day', '+20 hours'), 1, 1),
(10, 9, DATE('now'), datetime('now', 'start of day', '+14 hours'), datetime('now', 'start of day', '+22 hours'), 1, 1),
-- 明天排班
(1, 1, DATE('now', '+1 day'), datetime('now', '+1 day', 'start of day', '+8 hours'), datetime('now', '+1 day', 'start of day', '+16 hours'), 1, 1),
(3, 3, DATE('now', '+1 day'), datetime('now', '+1 day', 'start of day', '+8 hours'), datetime('now', '+1 day', 'start of day', '+16 hours'), 1, 1),
(5, 4, DATE('now', '+1 day'), datetime('now', '+1 day', 'start of day', '+10 hours'), datetime('now', '+1 day', 'start of day', '+18 hours'), 1, 1);

-- ============================================
-- 8. 存款记录
-- ============================================
INSERT OR IGNORE INTO deposits (player_id, order_no, amount, payment_method, status, processed_by, processed_at, created_at) VALUES
(1, 'DEP20241101001', 50000.00, 'bank_transfer', 1, 2, datetime('now', '-7 days'), datetime('now', '-7 days')),
(1, 'DEP20241105001', 30000.00, 'alipay', 1, 2, datetime('now', '-3 days'), datetime('now', '-3 days')),
(2, 'DEP20241102001', 20000.00, 'wechat', 1, 2, datetime('now', '-6 days'), datetime('now', '-6 days')),
(5, 'DEP20241103001', 100000.00, 'usdt', 1, 2, datetime('now', '-5 days'), datetime('now', '-5 days')),
(5, 'DEP20241108001', 80000.00, 'bank_transfer', 1, 2, datetime('now', '-1 day'), datetime('now', '-1 day')),
(10, 'DEP20241104001', 50000.00, 'bank_transfer', 1, 2, datetime('now', '-4 days'), datetime('now', '-4 days')),
(14, 'DEP20241107001', 200000.00, 'usdt', 1, 2, datetime('now', '-2 days'), datetime('now', '-2 days')),
(3, 'DEP20241109001', 15000.00, 'alipay', 1, 2, datetime('now'), datetime('now')),
(8, 'DEP20241109002', 30000.00, 'wechat', 1, 2, datetime('now'), datetime('now')),
(12, 'DEP20241109003', 10000.00, 'bank_transfer', 0, NULL, NULL, datetime('now'));

-- ============================================
-- 9. 提款记录
-- ============================================
INSERT OR IGNORE INTO withdrawals (player_id, order_no, amount, bank_name, bank_account, account_name, required_turnover, actual_turnover, turnover_check, status, reviewed_by, reviewed_at, created_at) VALUES
(1, 'WD20241105001', 20000.00, '工商银行', '6222021234567890123', '张伟', 60000.00, 85000.00, 1, 4, 2, datetime('now', '-3 days'), datetime('now', '-3 days')),
(2, 'WD20241106001', 15000.00, '建设银行', '6217001234567890123', '李明', 45000.00, 52000.00, 1, 4, 2, datetime('now', '-2 days'), datetime('now', '-2 days')),
(5, 'WD20241108001', 50000.00, '招商银行', '6225881234567890123', '陈静', 150000.00, 180000.00, 1, 1, 2, datetime('now', '-1 day'), datetime('now', '-1 day')),
-- 待审核提款
(1, 'WD20241109001', 25000.00, '工商银行', '6222021234567890123', '张伟', 75000.00, 92000.00, 1, 0, NULL, NULL, datetime('now', '-2 hours')),
(10, 'WD20241109002', 35000.00, '农业银行', '6228481234567890123', '郑华', 105000.00, 125000.00, 1, 0, NULL, NULL, datetime('now', '-1 hour')),
(14, 'WD20241109003', 80000.00, '中国银行', '6213351234567890123', '林涛', 240000.00, 280000.00, 1, 0, NULL, NULL, datetime('now', '-30 minutes')),
(3, 'WD20241109004', 8000.00, '交通银行', '6222621234567890123', '王芳', 24000.00, 18000.00, 0, 0, NULL, NULL, datetime('now', '-10 minutes'));

-- ============================================
-- 10. 注单数据 (最近7天)
-- ============================================
INSERT OR IGNORE INTO bets (bet_no, player_id, table_id, game_round, game_type, bet_type, bet_amount, odds, payout_amount, profit_loss, valid_bet, status, bet_at) VALUES
-- 今天的注单
('BET20241109001', 1, 1, 'BAC-001-20241109-001', 'baccarat', '庄', 5000.00, 0.95, 4750.00, -250.00, 5000.00, 1, datetime('now', '-4 hours')),
('BET20241109002', 1, 1, 'BAC-001-20241109-002', 'baccarat', '闲', 8000.00, 1.00, 16000.00, 8000.00, 8000.00, 1, datetime('now', '-3 hours')),
('BET20241109003', 5, 3, 'BAC-003-20241109-001', 'baccarat', '庄', 50000.00, 0.95, 97500.00, 47500.00, 50000.00, 1, datetime('now', '-3.5 hours')),
('BET20241109004', 5, 3, 'BAC-003-20241109-002', 'baccarat', '闲', 30000.00, 1.00, 0.00, -30000.00, 30000.00, 1, datetime('now', '-2.5 hours')),
('BET20241109005', 10, 1, 'BAC-001-20241109-003', 'baccarat', '和', 2000.00, 8.00, 18000.00, 16000.00, 2000.00, 1, datetime('now', '-2 hours')),
('BET20241109006', 2, 4, 'DT-001-20241109-001', 'dragon_tiger', '龙', 3000.00, 1.00, 6000.00, 3000.00, 3000.00, 1, datetime('now', '-2 hours')),
('BET20241109007', 3, 5, 'DT-002-20241109-001', 'dragon_tiger', '虎', 1500.00, 1.00, 0.00, -1500.00, 1500.00, 1, datetime('now', '-1.5 hours')),
('BET20241109008', 8, 7, 'SIC-001-20241109-001', 'sicbo', '大', 5000.00, 1.00, 10000.00, 5000.00, 5000.00, 1, datetime('now', '-1 hour')),
('BET20241109009', 14, 3, 'BAC-003-20241109-003', 'baccarat', '庄', 100000.00, 0.95, 0.00, -100000.00, 100000.00, 1, datetime('now', '-45 minutes')),
('BET20241109010', 14, 3, 'BAC-003-20241109-004', 'baccarat', '闲', 80000.00, 1.00, 160000.00, 80000.00, 80000.00, 1, datetime('now', '-30 minutes')),
-- 未结算注单
('BET20241109011', 1, 1, 'BAC-001-20241109-005', 'baccarat', '庄', 10000.00, 0.95, 0.00, 0.00, 10000.00, 0, datetime('now', '-5 minutes')),
('BET20241109012', 5, 3, 'BAC-003-20241109-005', 'baccarat', '闲', 25000.00, 1.00, 0.00, 0.00, 25000.00, 0, datetime('now', '-3 minutes')),

-- 昨天的注单
('BET20241108001', 1, 1, 'BAC-001-20241108-001', 'baccarat', '闲', 6000.00, 1.00, 12000.00, 6000.00, 6000.00, 1, datetime('now', '-1 day', '-6 hours')),
('BET20241108002', 2, 2, 'BAC-002-20241108-001', 'baccarat', '庄', 4000.00, 0.95, 0.00, -4000.00, 4000.00, 1, datetime('now', '-1 day', '-5 hours')),
('BET20241108003', 5, 3, 'BAC-003-20241108-001', 'baccarat', '庄', 80000.00, 0.95, 156000.00, 76000.00, 80000.00, 1, datetime('now', '-1 day', '-4 hours')),
('BET20241108004', 10, 1, 'BAC-001-20241108-002', 'baccarat', '闲', 15000.00, 1.00, 0.00, -15000.00, 15000.00, 1, datetime('now', '-1 day', '-3 hours')),
('BET20241108005', 8, 4, 'DT-001-20241108-001', 'dragon_tiger', '龙', 8000.00, 1.00, 16000.00, 8000.00, 8000.00, 1, datetime('now', '-1 day', '-2 hours')),
('BET20241108006', 3, 6, 'ROU-001-20241108-001', 'roulette', '红', 2000.00, 1.00, 4000.00, 2000.00, 2000.00, 1, datetime('now', '-1 day', '-1 hour')),

-- 前天的注单
('BET20241107001', 1, 1, 'BAC-001-20241107-001', 'baccarat', '庄', 12000.00, 0.95, 23400.00, 11400.00, 12000.00, 1, datetime('now', '-2 days', '-8 hours')),
('BET20241107002', 14, 3, 'BAC-003-20241107-001', 'baccarat', '闲', 150000.00, 1.00, 300000.00, 150000.00, 150000.00, 1, datetime('now', '-2 days', '-6 hours')),
('BET20241107003', 5, 3, 'BAC-003-20241107-002', 'baccarat', '庄', 60000.00, 0.95, 0.00, -60000.00, 60000.00, 1, datetime('now', '-2 days', '-4 hours')),
('BET20241107004', 2, 4, 'DT-001-20241107-001', 'dragon_tiger', '虎', 5000.00, 1.00, 0.00, -5000.00, 5000.00, 1, datetime('now', '-2 days', '-2 hours')),

-- 更早的注单
('BET20241106001', 1, 2, 'BAC-002-20241106-001', 'baccarat', '闲', 8000.00, 1.00, 0.00, -8000.00, 8000.00, 1, datetime('now', '-3 days', '-5 hours')),
('BET20241106002', 10, 1, 'BAC-001-20241106-001', 'baccarat', '庄', 20000.00, 0.95, 39000.00, 19000.00, 20000.00, 1, datetime('now', '-3 days', '-3 hours')),
('BET20241105001', 5, 3, 'BAC-003-20241105-001', 'baccarat', '闲', 45000.00, 1.00, 90000.00, 45000.00, 45000.00, 1, datetime('now', '-4 days', '-4 hours')),
('BET20241104001', 14, 3, 'BAC-003-20241104-001', 'baccarat', '庄', 200000.00, 0.95, 0.00, -200000.00, 200000.00, 1, datetime('now', '-5 days', '-6 hours')),
('BET20241103001', 8, 7, 'SIC-001-20241103-001', 'sicbo', '小', 6000.00, 1.00, 12000.00, 6000.00, 6000.00, 1, datetime('now', '-6 days', '-3 hours'));

-- ============================================
-- 11. 流水记录
-- ============================================
INSERT OR IGNORE INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark, created_at) VALUES
(1, 'deposit', 'DEP20241101001', 50000.00, 0.00, 50000.00, '首存', datetime('now', '-7 days')),
(1, 'bet', 'BET20241109001', -5000.00, 165000.00, 160000.00, '百家乐投注', datetime('now', '-4 hours')),
(1, 'payout', 'BET20241109001', 4750.00, 160000.00, 164750.00, '百家乐派彩', datetime('now', '-4 hours')),
(5, 'deposit', 'DEP20241103001', 100000.00, 150000.00, 250000.00, 'USDT充值', datetime('now', '-5 days')),
(5, 'bet', 'BET20241109003', -50000.00, 380000.00, 330000.00, '百家乐VIP厅投注', datetime('now', '-3.5 hours')),
(5, 'payout', 'BET20241109003', 97500.00, 330000.00, 427500.00, '百家乐VIP厅派彩', datetime('now', '-3.5 hours'));

-- ============================================
-- 12. 洗码结算记录
-- ============================================
INSERT OR IGNORE INTO commission_settlements (player_id, scheme_id, period_start, period_end, valid_bet, commission_rate, commission_amount, status, created_at) VALUES
(1, 2, DATE('now', '-7 days'), DATE('now', '-1 day'), 85000.00, 0.0080, 680.00, 0, datetime('now', '-1 hour')),
(5, 3, DATE('now', '-7 days'), DATE('now', '-1 day'), 265000.00, 0.0120, 3180.00, 0, datetime('now', '-1 hour')),
(10, 2, DATE('now', '-7 days'), DATE('now', '-1 day'), 55000.00, 0.0080, 440.00, 1, datetime('now', '-2 days')),
(2, 1, DATE('now', '-7 days'), DATE('now', '-1 day'), 17000.00, 0.0050, 85.00, 1, datetime('now', '-2 days'));

-- ============================================
-- 13. 风险预警记录
-- ============================================
INSERT OR IGNORE INTO risk_alerts (alert_type, severity, player_id, table_id, alert_data, status, created_at) VALUES
('big_bet', 'high', 14, 3, '{"message": "单笔投注超过100,000，金额: ¥100,000", "bet_no": "BET20241109009"}', 0, datetime('now', '-45 minutes')),
('high_win', 'medium', 5, 3, '{"message": "连续3局获胜，累计盈利: ¥17,500", "rounds": 3}', 0, datetime('now', '-2 hours')),
('arb_suspect', 'high', 7, 1, '{"message": "检测到对冲投注嫌疑，同时下注庄闲", "ip": "192.168.1.100"}', 0, datetime('now', '-3 hours')),
('ip_abnormal', 'low', 11, NULL, '{"message": "登录IP与注册IP不同城市", "register_ip": "北京", "login_ip": "上海"}', 1, datetime('now', '-1 day')),
('big_bet', 'critical', 14, 3, '{"message": "单日累计投注超过500,000", "total": "¥530,000"}', 0, datetime('now', '-30 minutes'));

-- ============================================
-- 14. 限红配置
-- ============================================
INSERT OR IGNORE INTO limit_configs (config_name, game_type, min_bet, max_bet, max_payout, daily_max_win) VALUES
('普通限红', 'baccarat', 10.00, 50000.00, 250000.00, 500000.00),
('VIP限红', 'baccarat', 100.00, 500000.00, 2500000.00, 5000000.00),
('高风险限红', 'baccarat', 10.00, 10000.00, 50000.00, 100000.00),
('普通限红', 'dragon_tiger', 10.00, 30000.00, 150000.00, 300000.00),
('普通限红', 'roulette', 5.00, 10000.00, 350000.00, 200000.00),
('普通限红', 'sicbo', 10.00, 30000.00, 150000.00, 300000.00);

-- ============================================
-- 15. 公告数据
-- ============================================
INSERT OR IGNORE INTO announcements (title, content, announcement_type, language, target_audience, display_order, status, created_by, created_at) VALUES
('系统维护通知', '尊敬的用户，系统将于每周二凌晨2:00-4:00进行例行维护，届时部分功能可能暂时无法使用，请提前做好安排。', 'marquee', 'zh-CN', 'all', 100, 1, 1, datetime('now', '-5 days')),
('VIP会员福利升级', '即日起，VIP5及以上会员可享受专属返水比例提升0.2%，更多福利请联系您的专属客服。', 'popup', 'zh-CN', 'vip', 90, 1, 1, datetime('now', '-3 days')),
('新游戏上线预告', '全新牛牛游戏即将上线！敬请期待更多精彩玩法。', 'banner', 'zh-CN', 'all', 80, 0, 1, datetime('now', '-1 day')),
('代理佣金结算通知', '本月代理佣金将于每月1日进行结算，请各位代理及时核对数据。', 'marquee', 'zh-CN', 'agent', 70, 1, 1, datetime('now', '-2 days'));

-- ============================================
-- 16. 系统配置
-- ============================================
INSERT OR IGNORE INTO system_configs (config_key, config_value, config_type, description) VALUES
('site_name', '真人荷官视讯', 'string', '网站名称'),
('maintenance_mode', 'false', 'boolean', '维护模式开关'),
('max_withdrawal_daily', '100000', 'number', '每日最大提款金额'),
('min_withdrawal', '100', 'number', '最小提款金额'),
('auto_settle_commission', 'true', 'boolean', '是否自动结算洗码'),
('risk_alert_big_bet', '50000', 'number', '大额投注预警阈值'),
('risk_alert_daily_win', '100000', 'number', '单日盈利预警阈值');

-- ============================================
-- 17. 操作日志
-- ============================================
INSERT OR IGNORE INTO operation_logs (admin_id, module, action, target_type, target_id, details, ip_address, created_at) VALUES
(1, 'player', 'create', 'player', 15, '{"username": "player015"}', '192.168.1.1', datetime('now', '-1 hour')),
(2, 'finance', 'approve', 'withdrawal', 1, '{"amount": 20000}', '192.168.1.2', datetime('now', '-3 days')),
(3, 'risk', 'handle', 'risk_alert', 4, '{"action": "observe"}', '192.168.1.3', datetime('now', '-1 day')),
(1, 'commission', 'approve', 'commission_settlement', 3, '{"amount": 440}', '192.168.1.1', datetime('now', '-2 days'));

-- ============================================
-- 18. 角色权限数据 (RBAC)
-- ============================================
INSERT OR IGNORE INTO admin_roles (id, role_name, role_display_name, permissions, description, status) VALUES
(1, 'super_admin', '超级管理员', '["*"]', '拥有所有权限', 1),
(2, 'finance', '财务主管', '["dashboard:read", "player:read", "finance:*", "commission:*", "report:read"]', '负责财务审核和洗码结算', 1),
(3, 'risk_officer', '风控专员', '["dashboard:read", "player:read", "player:freeze", "bet:read", "risk:*"]', '负责风险监控和预警处理', 1),
(4, 'operator', '运营专员', '["dashboard:read", "player:*", "agent:read", "content:*", "studio:*"]', '负责日常运营和内容管理', 1),
(5, 'customer_service', '客服专员', '["dashboard:read", "player:read", "finance:deposit", "finance:adjustment"]', '负责客户服务和人工存款', 1);

-- 管理员角色绑定
INSERT OR IGNORE INTO admin_role_bindings (admin_id, role_id) VALUES
(1, 1), -- admin -> super_admin
(2, 2), -- finance01 -> finance
(3, 3), -- risk01 -> risk_officer
(4, 4); -- operator01 -> operator

-- ============================================
-- 19. 玩家在线状态
-- ============================================
INSERT OR IGNORE INTO player_online_status (player_id, is_online, current_table_id, current_game_type, login_time, last_active_time, ip_address) VALUES
(1, 1, 1, 'baccarat', datetime('now', '-2 hours'), datetime('now', '-5 minutes'), '192.168.1.101'),
(5, 1, 3, 'baccarat', datetime('now', '-3 hours'), datetime('now', '-3 minutes'), '192.168.1.102'),
(10, 1, 1, 'baccarat', datetime('now', '-1 hour'), datetime('now', '-10 minutes'), '192.168.1.103'),
(14, 1, 3, 'baccarat', datetime('now', '-30 minutes'), datetime('now', '-2 minutes'), '192.168.1.104'),
(2, 1, 4, 'dragon_tiger', datetime('now', '-1 hour'), datetime('now', '-15 minutes'), '192.168.1.105'),
(3, 0, NULL, NULL, datetime('now', '-1 day'), datetime('now', '-1 day'), '192.168.1.106'),
(8, 1, 7, 'sicbo', datetime('now', '-45 minutes'), datetime('now', '-8 minutes'), '192.168.1.107');

-- ============================================
-- 20. 玩家银行卡
-- ============================================
INSERT OR IGNORE INTO player_bank_cards (player_id, bank_name, bank_account, account_name, is_default) VALUES
(1, '工商银行', '6222021234567890123', '张伟', 1),
(1, '建设银行', '6217001234567890456', '张伟', 0),
(2, '建设银行', '6217001234567890123', '李明', 1),
(5, '招商银行', '6225881234567890123', '陈静', 1),
(10, '农业银行', '6228481234567890123', '郑华', 1),
(14, '中国银行', '6213351234567890123', '林涛', 1);

-- ============================================
-- 21. 限红组配置
-- ============================================
INSERT OR IGNORE INTO limit_groups (id, group_name, description, is_default, status) VALUES
(1, 'A组', '普通玩家限红组', 1, 1),
(2, 'B组', '新手玩家限红组', 0, 1),
(3, 'VIP组', 'VIP玩家限红组', 0, 1),
(4, '高风险组', '高风险玩家限红组（限制投注）', 0, 1);

INSERT OR IGNORE INTO limit_group_configs (group_id, game_type, bet_type, min_bet, max_bet, max_payout) VALUES
-- A组
(1, 'baccarat', '庄', 10.00, 50000.00, 250000.00),
(1, 'baccarat', '闲', 10.00, 50000.00, 250000.00),
(1, 'baccarat', '和', 10.00, 10000.00, 80000.00),
(1, 'dragon_tiger', '龙', 10.00, 30000.00, 150000.00),
(1, 'dragon_tiger', '虎', 10.00, 30000.00, 150000.00),
-- VIP组
(3, 'baccarat', '庄', 100.00, 500000.00, 2500000.00),
(3, 'baccarat', '闲', 100.00, 500000.00, 2500000.00),
(3, 'baccarat', '和', 100.00, 100000.00, 800000.00),
-- 高风险组
(4, 'baccarat', '庄', 10.00, 5000.00, 25000.00),
(4, 'baccarat', '闲', 10.00, 5000.00, 25000.00);

-- ============================================
-- 22. 风控规则
-- ============================================
INSERT OR IGNORE INTO risk_rules (rule_name, rule_type, rule_condition, severity, action, is_enabled, description) VALUES
('单注大额预警', 'big_bet', '{"min_amount": 50000}', 'high', 'alert', 1, '单笔投注超过5万触发预警'),
('单日累计大额', 'big_bet', '{"daily_total": 200000}', 'critical', 'alert', 1, '单日累计投注超过20万'),
('连续获胜预警', 'consecutive_win', '{"min_rounds": 5, "min_profit": 10000}', 'medium', 'observe', 1, '连续5局获胜且盈利超过1万'),
('同IP多账户', 'ip_multi_account', '{"min_accounts": 3}', 'high', 'lock', 1, '同一IP登录3个以上账户'),
('对冲投注嫌疑', 'arb_suspect', '{"same_round": true, "opposite_bet": true}', 'high', 'alert', 1, '检测同局对冲投注');

-- ============================================
-- 23. IP关联分析
-- ============================================
INSERT OR IGNORE INTO ip_analysis (ip_address, player_ids, player_count, risk_score, is_suspicious) VALUES
('192.168.1.100', '[7, 11]', 2, 65, 1),
('192.168.1.101', '[1]', 1, 10, 0),
('192.168.1.102', '[5]', 1, 5, 0);

-- ============================================
-- 24. 高赔率注单监控
-- ============================================
INSERT OR IGNORE INTO high_odds_bets (bet_id, player_id, bet_type, odds, bet_amount, potential_payout, is_flagged) VALUES
(5, 10, '和', 8.00, 2000.00, 18000.00, 0);

-- ============================================
-- 25. 日结报表缓存
-- ============================================
INSERT OR IGNORE INTO daily_reports (report_date, total_bet_amount, total_bet_count, total_valid_bet, total_payout, platform_profit, total_deposit, deposit_count, total_withdrawal, withdrawal_count, new_players, active_players, total_commission) VALUES
(DATE('now', '-1 day'), 565000.00, 18, 565000.00, 612500.00, -47500.00, 110000.00, 3, 85000.00, 3, 2, 8, 1205.00),
(DATE('now', '-2 days'), 432000.00, 15, 432000.00, 398000.00, 34000.00, 250000.00, 2, 0.00, 0, 1, 7, 980.00),
(DATE('now', '-3 days'), 288000.00, 12, 288000.00, 312000.00, -24000.00, 95000.00, 2, 35000.00, 2, 0, 6, 650.00);

-- ============================================
-- 26. 轮播图
-- ============================================
INSERT OR IGNORE INTO banners (title, image_url, link_url, link_type, position, display_order, target_audience, status, created_by) VALUES
('迎新优惠', 'https://example.com/banners/welcome.jpg', '/promotions/welcome', 'internal', 'home', 100, 'all', 1, 1),
('VIP专属福利', 'https://example.com/banners/vip.jpg', '/vip/benefits', 'internal', 'home', 90, 'vip', 1, 1),
('百家乐锦标赛', 'https://example.com/banners/tournament.jpg', '/events/baccarat', 'internal', 'game_lobby', 80, 'all', 1, 1);

-- ============================================
-- 27. 荷官评分
-- ============================================
INSERT OR IGNORE INTO dealer_ratings (dealer_id, rating_type, rating_score, rating_period_start, rating_period_end, comments, rated_by) VALUES
(1, 'performance', 4.95, DATE('now', '-30 days'), DATE('now'), '表现优秀，深受玩家喜爱', 1),
(2, 'performance', 4.88, DATE('now', '-30 days'), DATE('now'), '服务态度好', 1),
(3, 'appearance', 4.92, DATE('now', '-30 days'), DATE('now'), '形象气质佳', 1),
(8, 'service', 4.90, DATE('now', '-30 days'), DATE('now'), '专业素养高', 1);

-- ============================================
-- 28. 定时任务配置
-- ============================================
INSERT OR IGNORE INTO scheduled_tasks (task_name, task_type, cron_expression, last_run_at, next_run_at, last_run_status, is_enabled) VALUES
('每日洗码计算', 'commission_calculate', '0 2 * * *', datetime('now', '-1 day', '+2 hours'), datetime('now', '+2 hours'), 'success', 1),
('日结报表生成', 'report_generate', '0 3 * * *', datetime('now', '-1 day', '+3 hours'), datetime('now', '+3 hours'), 'success', 1),
('风控扫描', 'risk_scan', '*/5 * * * *', datetime('now', '-5 minutes'), datetime('now', '+5 minutes'), 'success', 1);

-- ============================================
-- 29. 收款方式配置 (V2.1.3 新增)
-- ============================================
INSERT OR IGNORE INTO payment_methods (id, method_code, method_name, method_type, currency, account_name, account_number, bank_name, bank_branch, min_amount, max_amount, daily_limit, fee_type, fee_value, exchange_rate, display_order, status, is_default, description, created_by) VALUES
-- 加密货币
(1, 'usdt_trc20', 'USDT-TRC20', 'crypto', 'USDT', 'TRC20钱包', 'TRC20WalletAddress123456789', NULL, NULL, 10.00, 100000.00, NULL, 'none', 0, 7.25, 10, 1, 1, '支持TRC20网络，到账快速，手续费低', 1),
(2, 'usdt_erc20', 'USDT-ERC20', 'crypto', 'USDT', 'ERC20钱包', 'ERC20WalletAddress987654321', NULL, NULL, 50.00, 100000.00, NULL, 'none', 0, 7.25, 20, 1, 0, '支持ERC20网络，安全稳定', 1),
(3, 'btc', 'Bitcoin (BTC)', 'crypto', 'BTC', 'BTC钱包', 'BTCWalletAddressXXXXXXX', NULL, NULL, 0.001, 10.00, NULL, 'percent', 0.5, 450000.00, 30, 0, 0, 'BTC充值，确认时间较长', 1),

-- 银行卡
(4, 'bank_icbc', '工商银行', 'bank', 'CNY', '张三', '6222021234567890123', '中国工商银行', '北京朝阳支行', 100.00, 500000.00, 2000000.00, 'none', 0, NULL, 100, 1, 0, '工商银行对公转账，24小时到账', 1),
(5, 'bank_ccb', '建设银行', 'bank', 'CNY', '李四', '6217001234567890456', '中国建设银行', '上海浦东支行', 100.00, 500000.00, 2000000.00, 'none', 0, NULL, 110, 1, 0, '建设银行对公转账', 1),
(6, 'bank_abc', '农业银行', 'bank', 'CNY', '王五', '6228481234567890789', '中国农业银行', '广州天河支行', 100.00, 300000.00, 1000000.00, 'none', 0, NULL, 120, 0, 0, '农业银行转账 (暂停使用)', 1),

-- 电子钱包
(7, 'alipay', '支付宝', 'ewallet', 'CNY', '公司支付宝', 'company@alipay.com', NULL, NULL, 100.00, 50000.00, 200000.00, 'none', 0, NULL, 200, 1, 0, '支付宝扫码支付', 1),
(8, 'wechat', '微信支付', 'ewallet', 'CNY', '公司微信', 'wechat_company', NULL, NULL, 100.00, 50000.00, 200000.00, 'none', 0, NULL, 210, 1, 0, '微信扫码支付', 1),
(9, 'gcash', 'GCash', 'ewallet', 'PHP', 'GCash账户', '+63912345678', NULL, NULL, 500.00, 100000.00, 500000.00, 'percent', 1.0, 0.13, 300, 0, 0, 'GCash菲律宾电子钱包', 1);

-- 收款方式统计初始化数据
INSERT OR IGNORE INTO payment_method_stats (method_id, stat_date, deposit_count, deposit_amount, success_count, success_amount) VALUES
(1, DATE('now'), 15, 25000.00, 14, 24000.00),
(1, DATE('now', '-1 day'), 12, 18000.00, 12, 18000.00),
(4, DATE('now'), 8, 120000.00, 7, 100000.00),
(7, DATE('now'), 25, 35000.00, 24, 34500.00);
