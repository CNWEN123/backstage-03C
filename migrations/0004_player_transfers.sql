-- 会员转账记录表
CREATE TABLE IF NOT EXISTS player_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_no TEXT UNIQUE NOT NULL,
  from_player_id INTEGER NOT NULL,
  to_player_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  fee REAL DEFAULT 0,
  actual_amount REAL NOT NULL,
  from_balance_before REAL,
  from_balance_after REAL,
  to_balance_before REAL,
  to_balance_after REAL,
  status INTEGER DEFAULT 1, -- 0:处理中 1:成功 2:失败
  remark TEXT,
  ip_address TEXT,
  to_ip_address TEXT,
  device_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_transfers_from ON player_transfers(from_player_id);
CREATE INDEX IF NOT EXISTS idx_player_transfers_to ON player_transfers(to_player_id);
CREATE INDEX IF NOT EXISTS idx_player_transfers_no ON player_transfers(transfer_no);
CREATE INDEX IF NOT EXISTS idx_player_transfers_date ON player_transfers(created_at);
