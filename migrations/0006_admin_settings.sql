-- IP白名单表
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  description TEXT DEFAULT '',
  admin_id INTEGER,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);

-- 管理员登录日志表
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  admin_username TEXT,
  login_type TEXT DEFAULT 'login',
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  status INTEGER DEFAULT 1,
  fail_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin ON admin_login_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_created ON admin_login_logs(created_at);

-- 管理员2FA设置表 (如果不存在)
CREATE TABLE IF NOT EXISTS admin_2fa_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER UNIQUE,
  secret_key TEXT,
  is_enabled INTEGER DEFAULT 0,
  backup_codes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- 添加two_fa_enabled字段到admins表(如果不存在)
-- SQLite不支持IF NOT EXISTS for column，所以用PRAGMA检查
-- 这里我们假设字段可能已存在，如果执行失败会被忽略

-- 插入一些测试数据
INSERT OR IGNORE INTO ip_whitelist (ip_address, description, admin_id, status) VALUES
  ('127.0.0.1', '本地开发', 1, 1),
  ('192.168.1.0/24', '内网IP段', 1, 1);

-- 插入登录日志测试数据
INSERT INTO admin_login_logs (admin_id, admin_username, login_type, ip_address, user_agent, location, status) VALUES
  (1, 'admin', 'login', '127.0.0.1', 'Mozilla/5.0 Chrome', '本地', 1),
  (1, 'admin', 'login', '192.168.1.100', 'Mozilla/5.0 Safari', '内网', 1),
  (1, 'admin', 'logout', '192.168.1.100', 'Mozilla/5.0 Safari', '内网', 1);
