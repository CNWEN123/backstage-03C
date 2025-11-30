-- 代理分享链接和专属域名功能
-- V3.1.0

-- 添加代理分享码和专属域名字段 (不带UNIQUE约束，通过索引实现唯一性检查)
ALTER TABLE agents ADD COLUMN share_code TEXT;
ALTER TABLE agents ADD COLUMN custom_domain TEXT;
ALTER TABLE agents ADD COLUMN domain_status INTEGER DEFAULT 0; -- 0:未验证, 1:已验证, 2:验证失败

-- 为现有代理生成分享码
UPDATE agents SET share_code = 'AG' || printf('%06d', id) || substr(hex(randomblob(3)), 1, 4) WHERE share_code IS NULL;

-- 创建分享码唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_share_code ON agents(share_code);
CREATE INDEX IF NOT EXISTS idx_agents_custom_domain ON agents(custom_domain);

-- 域名绑定记录表 (可选，用于记录域名绑定历史)
CREATE TABLE IF NOT EXISTS agent_domain_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  status INTEGER DEFAULT 0, -- 0:待验证, 1:已绑定, 2:已解绑
  dns_txt_record TEXT, -- DNS验证记录
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 分享注册统计表
CREATE TABLE IF NOT EXISTS agent_share_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  share_code TEXT NOT NULL,
  registered_player_id INTEGER,
  register_ip TEXT,
  register_device TEXT,
  register_source TEXT DEFAULT 'share_link', -- share_link, custom_domain
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (registered_player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_share_stats_agent ON agent_share_stats(agent_id);
CREATE INDEX IF NOT EXISTS idx_share_stats_code ON agent_share_stats(share_code);
