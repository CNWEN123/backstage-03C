import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// 类型定义
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 配置
app.use('/api/*', cors())

// 静态文件服务
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================
// 工具函数
// ============================================

function generateOrderNo(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

function formatDate(date: Date | string) {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

// 安全工具函数
function escapeHtml(text: string): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 验证排序字段白名单
const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  players: ['id', 'username', 'balance', 'vip_level', 'created_at', 'last_login_at', 'status'],
  agents: ['id', 'username', 'agent_level', 'balance', 'created_at', 'status'],
  bets: ['id', 'bet_at', 'bet_amount', 'profit_loss', 'status'],
  withdrawals: ['id', 'created_at', 'amount', 'status'],
  deposits: ['id', 'created_at', 'amount', 'status']
}

function validateSortField(table: string, field: string): string {
  const allowed = ALLOWED_SORT_FIELDS[table] || ['id']
  return allowed.includes(field) ? field : 'id'
}

function validateSortOrder(order: string): string {
  return order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
}

// 简单的密码哈希函数 (生产环境应使用bcrypt)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'live_casino_salt_2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 验证密码
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

// 输入验证函数
function validateId(id: any): number | null {
  const parsed = parseInt(id)
  if (isNaN(parsed) || parsed <= 0) return null
  return parsed
}

function validateAmount(amount: any): number | null {
  const parsed = parseFloat(amount)
  if (isNaN(parsed) || parsed <= 0) return null
  return parsed
}

function validatePagination(page: any, limit: any): { page: number, limit: number } {
  let p = parseInt(page) || 1
  let l = parseInt(limit) || 20
  if (p < 1) p = 1
  if (l < 1) l = 1
  if (l > 100) l = 100  // 最大100条
  return { page: p, limit: l }
}

// 安全验证: 配置类型白名单
const ALLOWED_CONFIG_TYPES = ['deposit', 'bonus', 'withdrawal']
function validateConfigType(type: string | null | undefined): string | null {
  if (!type) return null
  return ALLOWED_CONFIG_TYPES.includes(type) ? type : null
}

// 安全验证: 活动类型白名单
const ALLOWED_ACTIVITY_TYPES = ['signup', 'first_deposit', 'reload', 'birthday', 'vip', 'daily', 'weekly']
function validateActivityType(type: string | null | undefined): string | null {
  if (!type) return null
  return ALLOWED_ACTIVITY_TYPES.includes(type) ? type : null
}

// 安全验证: 状态值验证 (必须是数字)
function validateStatus(status: any): number | null {
  const parsed = parseInt(status)
  if (isNaN(parsed) || parsed < 0 || parsed > 10) return null
  return parsed
}

// 安全验证: 字符串长度限制
function validateStringLength(str: string | null | undefined, maxLength: number = 255): string {
  if (!str) return ''
  return String(str).slice(0, maxLength)
}

// 安全验证: IP地址格式
function validateIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null
  // 简单的IP格式验证 (支持IPv4和CIDR)
  const ipPattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/
  return ipPattern.test(ip) ? ip : null
}

// ============================================
// 认证相关 API
// ============================================

// 管理员登录
app.post('/api/auth/login', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { username, password } = body
  
  if (!username || !password) {
    return c.json({ success: false, error: '请输入用户名和密码' }, 400)
  }
  
  try {
    // 查找管理员
    const admin = await DB.prepare(`
      SELECT id, username, real_name, role, status, password_hash, last_login_at, last_login_ip
      FROM admins WHERE username = ?
    `).bind(username).first()
    
    if (!admin) {
      return c.json({ success: false, error: '用户名或密码错误' }, 401)
    }
    
    // 检查账户状态
    if ((admin as any).status !== 1) {
      return c.json({ success: false, error: '账户已被锁定，请联系管理员' }, 403)
    }
    
    // 验证密码
    const isValid = await verifyPassword(password, (admin as any).password_hash)
    if (!isValid) {
      return c.json({ success: false, error: '用户名或密码错误' }, 401)
    }
    
    // 生成简单的session token
    const sessionToken = crypto.randomUUID()
    const loginIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    
    // 更新登录信息
    await DB.prepare(`
      UPDATE admins SET last_login_at = datetime('now'), last_login_ip = ? WHERE id = ?
    `).bind(loginIp, (admin as any).id).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details, ip_address)
      VALUES (?, 'auth', 'login', 'admin', ?, ?, ?)
    `).bind(
      (admin as any).id, 
      (admin as any).id, 
      JSON.stringify({ username: (admin as any).username }),
      loginIp
    ).run()
    
    // 获取角色信息
    const roles = await DB.prepare(`
      SELECT ar.role_name, ar.role_display_name, ar.permissions
      FROM admin_role_bindings arb
      JOIN admin_roles ar ON arb.role_id = ar.id
      WHERE arb.admin_id = ?
    `).bind((admin as any).id).all()
    
    return c.json({
      success: true,
      message: '登录成功',
      data: {
        id: (admin as any).id,
        username: (admin as any).username,
        realName: (admin as any).real_name,
        role: (admin as any).role,
        roles: roles.results,
        sessionToken,
        lastLoginAt: (admin as any).last_login_at,
        lastLoginIp: (admin as any).last_login_ip
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 验证登录状态
app.get('/api/auth/check', async (c) => {
  // 在实际应用中应该验证session token
  // 这里简化处理，前端使用localStorage存储登录状态
  return c.json({ success: true, message: 'Session valid' })
})

// 管理员登出
app.post('/api/auth/logout', async (c) => {
  const { DB } = c.env
  const body = await c.req.json().catch(() => ({}))
  const { adminId } = body as { adminId?: number }
  
  try {
    if (adminId) {
      const loginIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
      
      // 记录登出日志
      await DB.prepare(`
        INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details, ip_address)
        VALUES (?, 'auth', 'logout', 'admin', ?, '{}', ?)
      `).bind(adminId, adminId, loginIp).run()
    }
    
    return c.json({ success: true, message: '登出成功' })
  } catch (error) {
    return c.json({ success: true, message: '登出成功' }) // 即使出错也返回成功
  }
})

// 修改密码
app.post('/api/auth/change-password', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { adminId, oldPassword, newPassword } = body
  
  if (!adminId || !oldPassword || !newPassword) {
    return c.json({ success: false, error: '参数不完整' }, 400)
  }
  
  if (newPassword.length < 6) {
    return c.json({ success: false, error: '新密码长度至少6位' }, 400)
  }
  
  try {
    const admin = await DB.prepare(
      'SELECT id, password_hash FROM admins WHERE id = ?'
    ).bind(adminId).first()
    
    if (!admin) {
      return c.json({ success: false, error: '用户不存在' }, 404)
    }
    
    const isValid = await verifyPassword(oldPassword, (admin as any).password_hash)
    if (!isValid) {
      return c.json({ success: false, error: '原密码错误' }, 401)
    }
    
    const newHash = await hashPassword(newPassword)
    await DB.prepare(
      'UPDATE admins SET password_hash = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(newHash, adminId).run()
    
    return c.json({ success: true, message: '密码修改成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 仪表盘 API
// ============================================

app.get('/api/dashboard/stats', async (c) => {
  const { DB } = c.env
  
  try {
    const [
      playerCount,
      totalBalance,
      todayBets,
      withdrawalsCount,
      todayDeposits,
      todayWithdrawals,
      newPlayersToday,
      riskAlerts
    ] = await Promise.all([
      DB.prepare('SELECT COUNT(*) as count FROM players WHERE status = 1').first(),
      DB.prepare('SELECT SUM(balance) as total FROM players').first(),
      DB.prepare(`SELECT COUNT(*) as count, SUM(bet_amount) as total, SUM(profit_loss) as profit 
                  FROM bets WHERE DATE(bet_at) = DATE('now')`).first(),
      DB.prepare('SELECT COUNT(*) as count FROM withdrawals WHERE status = 0').first(),
      DB.prepare(`SELECT COUNT(*) as count, SUM(amount) as total 
                  FROM deposits WHERE DATE(created_at) = DATE('now') AND status = 1`).first(),
      DB.prepare(`SELECT COUNT(*) as count, SUM(amount) as total 
                  FROM withdrawals WHERE DATE(created_at) = DATE('now') AND status IN (1, 4)`).first(),
      DB.prepare(`SELECT COUNT(*) as count FROM players WHERE DATE(created_at) = DATE('now')`).first(),
      DB.prepare(`SELECT COUNT(*) as count FROM risk_alerts WHERE status = 0`).first()
    ])
    
    // 最近7天投注趋势
    const trendData = await DB.prepare(`
      SELECT DATE(bet_at) as date, SUM(bet_amount) as amount, COUNT(*) as count,
             SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as platform_win
      FROM bets 
      WHERE bet_at >= DATE('now', '-7 days')
      GROUP BY DATE(bet_at)
      ORDER BY date
    `).all()
    
    // 游戏类型分布
    const gameDistribution = await DB.prepare(`
      SELECT game_type, COUNT(*) as count, SUM(bet_amount) as amount
      FROM bets 
      WHERE DATE(bet_at) = DATE('now')
      GROUP BY game_type
    `).all()
    
    // 今日盈亏计算
    const todayProfit = todayBets?.profit ? -Number(todayBets.profit) : 0
    
    return c.json({
      success: true,
      data: {
        totalBalance: totalBalance?.total || 0,
        todayProfit,
        todayBetting: todayBets?.total || 0,
        todayBetCount: todayBets?.count || 0,
        onlinePlayers: playerCount?.count || 0,
        todayDeposit: todayDeposits?.total || 0,
        todayDepositCount: todayDeposits?.count || 0,
        todayWithdrawal: todayWithdrawals?.total || 0,
        todayWithdrawalCount: todayWithdrawals?.count || 0,
        pendingWithdrawals: withdrawalsCount?.count || 0,
        newPlayersToday: newPlayersToday?.count || 0,
        pendingRiskAlerts: riskAlerts?.count || 0,
        trendData: trendData.results || [],
        gameDistribution: gameDistribution.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 实时统计数据
app.get('/api/dashboard/realtime', async (c) => {
  const { DB } = c.env
  
  try {
    const [onlineTables, activeDealers, recentBets] = await Promise.all([
      DB.prepare(`SELECT COUNT(*) as count FROM game_tables WHERE status = 1`).first(),
      DB.prepare(`SELECT COUNT(*) as count FROM dealers WHERE status = 1`).first(),
      DB.prepare(`SELECT b.*, p.username, t.table_name 
                  FROM bets b 
                  LEFT JOIN players p ON b.player_id = p.id
                  LEFT JOIN game_tables t ON b.table_id = t.id
                  ORDER BY b.bet_at DESC LIMIT 10`).all()
    ])
    
    return c.json({
      success: true,
      data: {
        onlineTables: onlineTables?.count || 0,
        activeDealers: activeDealers?.count || 0,
        recentBets: recentBets.results || []
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 玩家管理 API
// ============================================

// 【重要】固定路径路由必须放在参数化路由之前！

// 在线玩家监控 (固定路径，必须在 /api/players/:id 之前)
// 实时监控当前在玩用户，显示所在游戏房间 - 规格说明书 V2.1
app.get('/api/players/online', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const gameType = c.req.query('game_type')
  const tableId = c.req.query('table_id')
  const search = c.req.query('search')
  const sortBy = c.req.query('sort_by') || 'last_activity' // last_activity, balance, login_time
  const sortOrder = c.req.query('sort_order') || 'DESC'
  
  try {
    // 主查询 - 获取在线玩家详细信息(含当前游戏房间)
    let query = `
      SELECT 
        p.id, p.username, p.nickname, p.vip_level, p.balance, p.agent_id,
        p.status, p.phone, p.email, p.last_login_ip, p.risk_tags,
        pos.ip_address as current_ip, pos.device_info as device_info, 
        pos.login_time as login_at, pos.last_active_time as last_activity,
        pos.current_table_id, pos.current_game_type, pos.session_id,
        a.username as agent_name, a.agent_level,
        gt.table_name, gt.table_code, gt.min_bet as table_min_bet, gt.max_bet as table_max_bet,
        d.stage_name as dealer_name
      FROM players p
      INNER JOIN player_online_status pos ON p.id = pos.player_id AND pos.is_online = 1
      LEFT JOIN agents a ON p.agent_id = a.id
      LEFT JOIN game_tables gt ON pos.current_table_id = gt.id
      LEFT JOIN dealers d ON gt.current_dealer_id = d.id
      WHERE 1=1
    `
    const params: any[] = []
    
    // 游戏类型筛选
    if (gameType) {
      query += ' AND pos.current_game_type = ?'
      params.push(gameType)
    }
    
    // 桌台筛选
    if (tableId) {
      query += ' AND pos.current_table_id = ?'
      params.push(tableId)
    }
    
    // 搜索功能(用户名/昵称)
    if (search) {
      query += ' AND (p.username LIKE ? OR p.nickname LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    
    // 排序
    const validSortFields: Record<string, string> = {
      'last_activity': 'pos.last_active_time',
      'balance': 'p.balance',
      'login_time': 'pos.login_time',
      'vip_level': 'p.vip_level'
    }
    const sortField = validSortFields[sortBy] || 'pos.last_active_time'
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计信息 - 包含各游戏类型在线人数
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_online,
        COUNT(DISTINCT pos.current_game_type) as active_games,
        COUNT(DISTINCT pos.current_table_id) as active_tables,
        SUM(CASE WHEN pos.current_game_type = 'baccarat' THEN 1 ELSE 0 END) as baccarat_count,
        SUM(CASE WHEN pos.current_game_type = 'dragon_tiger' THEN 1 ELSE 0 END) as dragon_tiger_count,
        SUM(CASE WHEN pos.current_game_type = 'roulette' THEN 1 ELSE 0 END) as roulette_count,
        SUM(CASE WHEN pos.current_game_type = 'sicbo' THEN 1 ELSE 0 END) as sicbo_count,
        SUM(CASE WHEN pos.current_game_type = 'niuniu' THEN 1 ELSE 0 END) as niuniu_count,
        SUM(p.balance) as total_balance
      FROM player_online_status pos
      LEFT JOIN players p ON pos.player_id = p.id
      WHERE pos.is_online = 1
    `).first()
    
    // 获取各桌台在线人数
    const tableStats = await DB.prepare(`
      SELECT 
        pos.current_table_id,
        gt.table_name,
        gt.table_code,
        pos.current_game_type,
        COUNT(*) as player_count
      FROM player_online_status pos
      LEFT JOIN game_tables gt ON pos.current_table_id = gt.id
      WHERE pos.is_online = 1 AND pos.current_table_id IS NOT NULL
      GROUP BY pos.current_table_id
      ORDER BY player_count DESC
    `).all()
    
    return c.json({
      success: true,
      data: result.results,
      total: stats?.total_online || 0,
      stats: {
        totalOnline: stats?.total_online || 0,
        activeGames: stats?.active_games || 0,
        activeTables: stats?.active_tables || 0,
        totalBalance: stats?.total_balance || 0,
        gameDistribution: {
          baccarat: stats?.baccarat_count || 0,
          dragon_tiger: stats?.dragon_tiger_count || 0,
          roulette: stats?.roulette_count || 0,
          sicbo: stats?.sicbo_count || 0,
          niuniu: stats?.niuniu_count || 0
        }
      },
      tableStats: tableStats.results,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家列表
app.get('/api/players', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const search = c.req.query('search') || ''
  const status = c.req.query('status')
  const vipLevel = c.req.query('vip_level')
  const agentId = c.req.query('agent_id')
  // 使用白名单验证排序字段
  const sortBy = validateSortField('players', c.req.query('sort_by') || 'id')
  const sortOrder = validateSortOrder(c.req.query('sort_order') || 'DESC')
  
  try {
    let query = 'SELECT id, username, nickname, real_name, balance, status, vip_level, agent_id, kyc_status, phone, email, created_at, last_login_at FROM players WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM players WHERE 1=1'
    const params: any[] = []
    const countParams: any[] = []
    
    if (search) {
      const searchCond = ' AND (username LIKE ? OR nickname LIKE ? OR real_name LIKE ? OR phone LIKE ?)'
      query += searchCond
      countQuery += searchCond
      // 使用参数化查询防止SQL注入
      const searchPattern = `%${search.replace(/[%_]/g, '\\$&')}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }
    
    if (status) {
      const statusVal = validateId(status)
      if (statusVal !== null) {
        query += ' AND status = ?'
        countQuery += ' AND status = ?'
        params.push(statusVal)
        countParams.push(statusVal)
      }
    }
    
    if (vipLevel) {
      const vipVal = validateId(vipLevel)
      if (vipVal !== null) {
        query += ' AND vip_level = ?'
        countQuery += ' AND vip_level = ?'
        params.push(vipVal)
        countParams.push(vipVal)
      }
    }
    
    if (agentId) {
      const agentVal = validateId(agentId)
      if (agentVal !== null) {
        query += ' AND agent_id = ?'
        countQuery += ' AND agent_id = ?'
        params.push(agentVal)
        countParams.push(agentVal)
      }
    }
    
    // 使用安全的排序字段和分页参数
    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    const countResult = await DB.prepare(countQuery).bind(...countParams).first()
    
    return c.json({
      success: true,
      data: result.results,
      total: countResult?.total || 0,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家详情
app.get('/api/players/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const player = await DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first()
    
    if (!player) {
      return c.json({ success: false, error: 'Player not found' }, 404)
    }
    
    // 获取相关数据
    const [bets, transactions, tags, deposits, withdrawals, agent] = await Promise.all([
      DB.prepare('SELECT * FROM bets WHERE player_id = ? ORDER BY bet_at DESC LIMIT 20').bind(id).all(),
      DB.prepare('SELECT * FROM transactions WHERE player_id = ? ORDER BY created_at DESC LIMIT 20').bind(id).all(),
      DB.prepare('SELECT * FROM player_tags WHERE player_id = ?').bind(id).all(),
      DB.prepare('SELECT SUM(amount) as total, COUNT(*) as count FROM deposits WHERE player_id = ? AND status = 1').bind(id).first(),
      DB.prepare('SELECT SUM(amount) as total, COUNT(*) as count FROM withdrawals WHERE player_id = ? AND status IN (1, 4)').bind(id).first(),
      player.agent_id ? DB.prepare('SELECT id, username FROM agents WHERE id = ?').bind(player.agent_id).first() : null
    ])
    
    // 统计数据
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_bets,
        SUM(bet_amount) as total_bet_amount,
        SUM(valid_bet) as total_valid_bet,
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as total_win,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as total_loss
      FROM bets WHERE player_id = ?
    `).bind(id).first()
    
    return c.json({
      success: true,
      data: {
        ...player,
        recentBets: bets.results,
        recentTransactions: transactions.results,
        tags: tags.results,
        totalDeposit: deposits?.total || 0,
        depositCount: deposits?.count || 0,
        totalWithdrawal: withdrawals?.total || 0,
        withdrawalCount: withdrawals?.count || 0,
        agent,
        stats
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建玩家
app.post('/api/players', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { username, password, nickname, real_name, phone, email, agent_id, vip_level } = body
  
  // 输入验证
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return c.json({ success: false, error: '用户名长度必须在3-32个字符之间' }, 400)
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return c.json({ success: false, error: '密码长度至少6个字符' }, 400)
  }
  // 用户名只允许字母数字下划线
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ success: false, error: '用户名只能包含字母、数字和下划线' }, 400)
  }
  
  try {
    // 检查用户名是否存在
    const existing = await DB.prepare('SELECT id FROM players WHERE username = ?').bind(username).first()
    if (existing) {
      return c.json({ success: false, error: '用户名已存在' }, 400)
    }
    
    // 密码哈希处理
    const passwordHash = await hashPassword(password)
    
    const result = await DB.prepare(`
      INSERT INTO players (username, password_hash, nickname, real_name, phone, email, agent_id, vip_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      username, 
      passwordHash, 
      escapeHtml(nickname || ''), 
      escapeHtml(real_name || ''), 
      phone || null, 
      email || null, 
      agent_id || null, 
      vip_level || 0
    ).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '玩家创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新玩家
app.put('/api/players/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    // 动态构建更新语句,只更新提供的字段
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      nickname: 'nickname',
      real_name: 'real_name',
      phone: 'phone',
      email: 'email',
      vip_level: 'vip_level',
      agent_id: 'agent_id',
      commission_scheme_id: 'commission_scheme_id',
      status: 'status',
      risk_level: 'risk_level',
      limit_group_id: 'limit_group_id'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE players SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '玩家信息更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家状态操作
app.post('/api/players/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { action, reason } = await c.req.json()
  
  try {
    let newStatus = 1
    if (action === 'freeze') newStatus = 2
    else if (action === 'unfreeze') newStatus = 1
    else if (action === 'review') newStatus = 3
    
    await DB.prepare(`
      UPDATE players SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(newStatus, id).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', ?, 'player', ?, ?)
    `).bind(action, id, JSON.stringify({ reason })).run()
    
    return c.json({ success: true, message: action === 'freeze' ? '玩家已冻结' : '玩家已解冻' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 添加玩家标签
app.post('/api/players/:id/tags', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { tag } = await c.req.json()
  
  try {
    await DB.prepare(`
      INSERT INTO player_tags (player_id, tag, added_by) VALUES (?, ?, 1)
    `).bind(id, tag).run()
    
    return c.json({ success: true, message: '标签添加成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除玩家标签
app.delete('/api/players/:playerId/tags/:tagId', async (c) => {
  const { DB } = c.env
  const { playerId, tagId } = c.req.param()
  
  try {
    await DB.prepare('DELETE FROM player_tags WHERE id = ? AND player_id = ?').bind(tagId, playerId).run()
    return c.json({ success: true, message: '标签删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 踢线功能 - 强制玩家下线
app.post('/api/players/:id/kick', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { reason } = await c.req.json()
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    // 更新在线状态为离线
    await DB.prepare(`
      UPDATE player_online_status 
      SET is_online = 0, last_active_time = datetime('now')
      WHERE player_id = ?
    `).bind(playerId).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', 'kick', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ reason: reason || '管理员踢线' })).run()
    
    return c.json({ success: true, message: '玩家已强制下线' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 代理转移 - 更换玩家所属代理
app.post('/api/players/:id/transfer', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { new_agent_id, reason } = await c.req.json()
  
  const playerId = validateId(id)
  const newAgentId = validateId(new_agent_id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    // 获取玩家当前代理
    const player = await DB.prepare('SELECT agent_id FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    const oldAgentId = player.agent_id
    
    // 验证新代理是否存在
    if (newAgentId !== null) {
      const agent = await DB.prepare('SELECT id FROM agents WHERE id = ?').bind(newAgentId).first()
      if (!agent) {
        return c.json({ success: false, error: '目标代理不存在' }, 400)
      }
    }
    
    // 更新玩家代理
    await DB.prepare(`
      UPDATE players SET agent_id = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(newAgentId, playerId).run()
    
    // 记录转移日志
    await DB.prepare(`
      INSERT INTO player_agent_transfers (player_id, from_agent_id, to_agent_id, reason, transferred_by)
      VALUES (?, ?, ?, ?, 1)
    `).bind(playerId, oldAgentId, newAgentId, reason || '管理员手动转移').run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', 'transfer', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ from_agent: oldAgentId, to_agent: newAgentId, reason })).run()
    
    return c.json({ success: true, message: '代理转移成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 洗码方案绑定 - 为玩家绑定洗码方案
app.post('/api/players/:id/bindScheme', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { scheme_id, reason } = await c.req.json()
  
  const playerId = validateId(id)
  const schemeId = validateId(scheme_id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    // 验证方案是否存在
    if (schemeId !== null) {
      const scheme = await DB.prepare('SELECT id FROM commission_schemes WHERE id = ?').bind(schemeId).first()
      if (!scheme) {
        return c.json({ success: false, error: '洗码方案不存在' }, 400)
      }
    }
    
    // 获取玩家当前方案
    const player = await DB.prepare('SELECT commission_scheme_id FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    // 更新玩家洗码方案
    await DB.prepare(`
      UPDATE players SET commission_scheme_id = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(schemeId, playerId).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', 'bind_scheme', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ old_scheme: player.commission_scheme_id, new_scheme: schemeId, reason })).run()
    
    return c.json({ success: true, message: '洗码方案绑定成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家LTV统计
app.get('/api/players/:id/ltv', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    // 获取玩家基本信息和统计
    const player = await DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    // 累计存款
    const deposits = await DB.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count FROM deposits WHERE player_id = ? AND status = 1
    `).bind(playerId).first()
    
    // 累计提款
    const withdrawals = await DB.prepare(`
      SELECT SUM(amount) as total, COUNT(*) as count FROM withdrawals WHERE player_id = ? AND status IN (1, 4)
    `).bind(playerId).first()
    
    // 累计投注
    const bets = await DB.prepare(`
      SELECT SUM(bet_amount) as total_bet, SUM(valid_bet) as valid_bet, SUM(profit_loss) as profit_loss, COUNT(*) as count
      FROM bets WHERE player_id = ?
    `).bind(playerId).first()
    
    // 累计洗码
    const commissions = await DB.prepare(`
      SELECT SUM(commission_amount) as total FROM commission_settlements WHERE player_id = ? AND status = 1
    `).bind(playerId).first()
    
    // 计算LTV指标
    const totalDeposit = Number(deposits?.total || 0)
    const totalWithdrawal = Number(withdrawals?.total || 0)
    const netDeposit = totalDeposit - totalWithdrawal
    const totalBet = Number(bets?.total_bet || 0)
    const validBet = Number(bets?.valid_bet || 0)
    const profitLoss = Number(bets?.profit_loss || 0)
    const totalCommission = Number(commissions?.total || 0)
    
    // 计算公司从该玩家获得的净利润
    const companyProfit = -profitLoss - totalCommission
    
    // 计算活跃天数
    const activeDays = await DB.prepare(`
      SELECT COUNT(DISTINCT DATE(bet_at)) as days FROM bets WHERE player_id = ?
    `).bind(playerId).first()
    
    return c.json({
      success: true,
      data: {
        player_id: playerId,
        username: player.username,
        vip_level: player.vip_level,
        register_date: player.created_at,
        total_deposit: totalDeposit,
        deposit_count: deposits?.count || 0,
        total_withdrawal: totalWithdrawal,
        withdrawal_count: withdrawals?.count || 0,
        net_deposit: netDeposit,
        total_bet: totalBet,
        valid_bet: validBet,
        bet_count: bets?.count || 0,
        player_profit_loss: profitLoss,
        total_commission: totalCommission,
        company_profit: companyProfit,
        active_days: activeDays?.days || 0,
        ltv_score: companyProfit > 0 ? Math.min(100, Math.round(companyProfit / 1000)) : 0
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 设置玩家风险等级
app.post('/api/players/:id/riskLevel', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { risk_level, reason } = await c.req.json()
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  // 验证风险等级 0-3
  const level = parseInt(risk_level)
  if (isNaN(level) || level < 0 || level > 3) {
    return c.json({ success: false, error: '无效的风险等级(0=普通,1=低风险,2=中风险,3=高风险)' }, 400)
  }
  
  try {
    const riskTags = JSON.stringify({ level, reason, updated_at: new Date().toISOString() })
    
    await DB.prepare(`
      UPDATE players SET risk_tags = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(riskTags, playerId).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', 'set_risk_level', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ risk_level: level, reason })).run()
    
    return c.json({ success: true, message: '风险等级设置成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 设置玩家限红组
app.post('/api/players/:id/limitGroup', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { limit_group, reason } = await c.req.json()
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  // 验证限红组
  const validGroups = ['A', 'B', 'C', 'VIP', 'SVIP']
  if (!limit_group || !validGroups.includes(limit_group.toUpperCase())) {
    return c.json({ success: false, error: '无效的限红组(A/B/C/VIP/SVIP)' }, 400)
  }
  
  try {
    // 检查player_limit_configs表是否有该玩家配置
    const existing = await DB.prepare(`
      SELECT id FROM player_limit_configs WHERE player_id = ?
    `).bind(playerId).first()
    
    if (existing) {
      await DB.prepare(`
        UPDATE player_limit_configs SET limit_group = ?, updated_at = datetime('now') WHERE player_id = ?
      `).bind(limit_group.toUpperCase(), playerId).run()
    } else {
      await DB.prepare(`
        INSERT INTO player_limit_configs (player_id, limit_group) VALUES (?, ?)
      `).bind(playerId, limit_group.toUpperCase()).run()
    }
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'player', 'set_limit_group', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ limit_group: limit_group.toUpperCase(), reason })).run()
    
    return c.json({ success: true, message: '限红组设置成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家流水查询 (专用)
app.get('/api/players/:id/transactions', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const type = c.req.query('type')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    let query = 'SELECT * FROM transactions WHERE player_id = ?'
    const params: any[] = [playerId]
    
    if (type) {
      query += ' AND transaction_type = ?'
      params.push(type)
    }
    if (dateFrom) {
      query += ' AND DATE(created_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      query += ' AND DATE(created_at) <= ?'
      params.push(dateTo)
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计
    let statsQuery = 'SELECT transaction_type, SUM(amount) as total, COUNT(*) as count FROM transactions WHERE player_id = ?'
    const statsParams: any[] = [playerId]
    if (dateFrom) {
      statsQuery += ' AND DATE(created_at) >= ?'
      statsParams.push(dateFrom)
    }
    if (dateTo) {
      statsQuery += ' AND DATE(created_at) <= ?'
      statsParams.push(dateTo)
    }
    statsQuery += ' GROUP BY transaction_type'
    
    const stats = await DB.prepare(statsQuery).bind(...statsParams).all()
    
    return c.json({
      success: true,
      data: result.results,
      stats: stats.results,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 玩家注单查询 (专用)
app.get('/api/players/:id/bets', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const gameType = c.req.query('game_type')
  const status = c.req.query('status')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  const playerId = validateId(id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  
  try {
    let query = `
      SELECT b.*, t.table_name 
      FROM bets b 
      LEFT JOIN game_tables t ON b.table_id = t.id 
      WHERE b.player_id = ?
    `
    const params: any[] = [playerId]
    
    if (gameType) {
      query += ' AND b.game_type = ?'
      params.push(gameType)
    }
    if (status !== undefined && status !== '') {
      query += ' AND b.status = ?'
      params.push(status)
    }
    if (dateFrom) {
      query += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      query += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    query += ' ORDER BY b.bet_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计
    const stats = await DB.prepare(`
      SELECT COUNT(*) as count, SUM(bet_amount) as total_bet, SUM(valid_bet) as valid_bet, SUM(profit_loss) as profit_loss
      FROM bets WHERE player_id = ?
    `).bind(playerId).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 代理管理 API
// ============================================

// 【重要】固定路径路由必须放在参数化路由之前！

// 代理树形结构 (固定路径，必须在 /api/agents/:id 之前)
app.get('/api/agents/tree', async (c) => {
  const { DB } = c.env
  const rootIdParam = c.req.query('root_id')
  
  try {
    let query = `
      SELECT a.*, 
             (SELECT COUNT(*) FROM players WHERE agent_id = a.id) as player_count,
             (SELECT COUNT(*) FROM agents WHERE parent_id = a.id) as sub_agent_count
      FROM agents a
    `
    const params: any[] = []
    
    // 使用参数化查询防止SQL注入
    if (rootIdParam) {
      const rootId = validateId(rootIdParam)
      if (rootId !== null) {
        query += ` WHERE a.agent_path LIKE ? OR a.id = ?`
        params.push(`%/${rootId}/%`, rootId)
      }
    }
    
    query += ' ORDER BY a.agent_level, a.id'
    
    const agents = await DB.prepare(query).bind(...params).all()
    
    // 构建树形结构
    const buildTree = (items: any[], parentId: number | null = null): any[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }))
    }
    
    const tree = buildTree(agents.results || [])
    
    return c.json({
      success: true,
      data: tree
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 代理列表
app.get('/api/agents', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const level = c.req.query('level')
  const parentId = c.req.query('parent_id')
  
  try {
    let query = `
      SELECT a.*, 
             (SELECT COUNT(*) FROM players WHERE agent_id = a.id) as player_count,
             (SELECT COUNT(*) FROM agents WHERE parent_id = a.id) as sub_agent_count
      FROM agents a
      WHERE 1=1
    `
    const params: any[] = []
    
    if (level) {
      const levelVal = validateId(level)
      if (levelVal !== null) {
        query += ' AND a.agent_level = ?'
        params.push(levelVal)
      }
    }
    
    if (parentId) {
      const parentVal = validateId(parentId)
      if (parentVal !== null) {
        query += ' AND a.parent_id = ?'
        params.push(parentVal)
      }
    }
    
    // 使用参数化查询
    query += ` ORDER BY a.agent_level, a.agent_path LIMIT ? OFFSET ?`
    params.push(limit, (page - 1) * limit)
    
    const agents = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: agents.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 代理详情
app.get('/api/agents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const agent = await DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first()
    
    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404)
    }
    
    const [subAgents, players, commissions, parent] = await Promise.all([
      DB.prepare('SELECT id, username, agent_level, balance, status FROM agents WHERE parent_id = ?').bind(id).all(),
      DB.prepare('SELECT id, username, balance, status FROM players WHERE agent_id = ? LIMIT 20').bind(id).all(),
      DB.prepare('SELECT * FROM agent_commissions WHERE agent_id = ? ORDER BY period_end DESC LIMIT 12').bind(id).all(),
      agent.parent_id ? DB.prepare('SELECT id, username FROM agents WHERE id = ?').bind(agent.parent_id).first() : null
    ])
    
    // 统计数据
    const stats = await DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM players WHERE agent_id = ?) as total_players,
        (SELECT SUM(balance) FROM players WHERE agent_id = ?) as players_balance,
        (SELECT COUNT(*) FROM agents WHERE parent_id = ?) as sub_agents
    `).bind(id, id, id).first()
    
    return c.json({
      success: true,
      data: {
        ...agent,
        subAgents: subAgents.results,
        players: players.results,
        commissions: commissions.results,
        parent,
        stats
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建代理
app.post('/api/agents', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { username, password, agent_level, parent_id, profit_share, commission_rate } = body
  
  // 输入验证
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return c.json({ success: false, error: '代理账号长度必须在3-32个字符之间' }, 400)
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return c.json({ success: false, error: '密码长度至少6个字符' }, 400)
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ success: false, error: '代理账号只能包含字母、数字和下划线' }, 400)
  }
  
  try {
    // 检查用户名
    const existing = await DB.prepare('SELECT id FROM agents WHERE username = ?').bind(username).first()
    if (existing) {
      return c.json({ success: false, error: '代理账号已存在' }, 400)
    }
    
    // 计算代理路径
    let agentPath = '/'
    if (parent_id) {
      const parentVal = validateId(parent_id)
      if (parentVal !== null) {
        const parent = await DB.prepare('SELECT agent_path FROM agents WHERE id = ?').bind(parentVal).first()
        if (parent) {
          agentPath = `${parent.agent_path}${parentVal}/`
        }
      }
    }
    
    // 密码哈希处理
    const passwordHash = await hashPassword(password)
    
    const result = await DB.prepare(`
      INSERT INTO agents (username, password_hash, agent_level, parent_id, agent_path, profit_share, commission_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(username, passwordHash, agent_level || 3, parent_id || null, agentPath, profit_share || 0, commission_rate || 0).run()
    
    // 更新路径包含自己的ID
    const newId = result.meta.last_row_id
    await DB.prepare(`UPDATE agents SET agent_path = ? WHERE id = ?`).bind(`${agentPath}${newId}/`, newId).run()
    
    return c.json({ success: true, id: newId, message: '代理创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新代理
app.put('/api/agents/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    // 动态构建更新语句,只更新提供的字段
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      profit_share: 'profit_share',
      profit_share_ratio: 'profit_share',
      commission_rate: 'commission_rate',
      status: 'status',
      phone: 'phone',
      email: 'email',
      remark: 'remark'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE agents SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '代理信息更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 财务管理 API
// ============================================

// 存款列表
app.get('/api/deposits', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const status = validateStatus(c.req.query('status'))
  const playerId = validateId(c.req.query('player_id'))
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    let query = `
      SELECT d.*, p.username, p.nickname
      FROM deposits d
      LEFT JOIN players p ON d.player_id = p.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== null) {
      query += ' AND d.status = ?'
      params.push(status)
    }
    
    if (playerId !== null) {
      query += ' AND d.player_id = ?'
      params.push(playerId)
    }
    
    if (dateFrom) {
      query += ' AND DATE(d.created_at) >= ?'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      query += ' AND DATE(d.created_at) <= ?'
      params.push(dateTo)
    }
    
    query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建存款 (人工存款)
app.post('/api/deposits', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { player_id, amount, payment_method, remark } = body
  
  // 输入验证
  const playerId = validateId(player_id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  const depositAmount = validateAmount(amount)
  if (depositAmount === null || depositAmount > 10000000) {
    return c.json({ success: false, error: '无效的存款金额(须大于0且不超过1千万)' }, 400)
  }
  
  try {
    const orderNo = generateOrderNo('DEP')
    
    // 获取玩家当前余额
    const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    const balanceBefore = Number(player.balance)
    const balanceAfter = balanceBefore + depositAmount
    
    // 创建存款记录
    await DB.prepare(`
      INSERT INTO deposits (player_id, order_no, amount, payment_method, status, processed_by, processed_at, remark)
      VALUES (?, ?, ?, ?, 1, 1, datetime('now'), ?)
    `).bind(playerId, orderNo, depositAmount, payment_method || 'manual', escapeHtml(remark || '')).run()
    
    // 更新玩家余额
    await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, playerId).run()
    
    // 创建流水记录
    await DB.prepare(`
      INSERT INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark, created_by)
      VALUES (?, 'deposit', ?, ?, ?, ?, ?, 1)
    `).bind(playerId, orderNo, depositAmount, balanceBefore, balanceAfter, escapeHtml(remark || '人工存款')).run()
    
    return c.json({ success: true, order_no: orderNo, message: '存款成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 提款审核列表
app.get('/api/withdrawals/pending', async (c) => {
  const { DB } = c.env
  
  try {
    const withdrawals = await DB.prepare(`
      SELECT w.*, p.username, p.nickname, p.balance as current_balance
      FROM withdrawals w
      LEFT JOIN players p ON w.player_id = p.id
      WHERE w.status = 0
      ORDER BY w.created_at DESC
    `).all()
    
    return c.json({
      success: true,
      data: withdrawals.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 提款列表
app.get('/api/withdrawals', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const status = validateStatus(c.req.query('status'))
  const playerId = validateId(c.req.query('player_id'))
  
  try {
    let query = `
      SELECT w.*, p.username, p.nickname
      FROM withdrawals w
      LEFT JOIN players p ON w.player_id = p.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== null) {
      query += ' AND w.status = ?'
      params.push(status)
    }
    
    if (playerId !== null) {
      query += ' AND w.player_id = ?'
      params.push(playerId)
    }
    
    query += ' ORDER BY w.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建提款 (人工提款)
app.post('/api/withdrawals', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { player_id, amount, bank_name, bank_account, account_name, remark } = body
  
  // 输入验证
  const playerId = validateId(player_id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  const withdrawAmount = validateAmount(amount)
  if (withdrawAmount === null || withdrawAmount > 5000000) {
    return c.json({ success: false, error: '无效的提款金额(须大于0且不超过500万)' }, 400)
  }
  
  try {
    // 获取玩家信息
    const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    if (Number(player.balance) < withdrawAmount) {
      return c.json({ success: false, error: '余额不足' }, 400)
    }
    
    const orderNo = generateOrderNo('WD')
    const balanceBefore = Number(player.balance)
    const balanceAfter = balanceBefore - withdrawAmount
    
    // 创建提款记录 (直接完成)
    await DB.prepare(`
      INSERT INTO withdrawals (player_id, order_no, amount, bank_name, bank_account, account_name, status, reviewed_by, reviewed_at, processed_by, processed_at, remark)
      VALUES (?, ?, ?, ?, ?, ?, 4, 1, datetime('now'), 1, datetime('now'), ?)
    `).bind(playerId, orderNo, withdrawAmount, escapeHtml(bank_name || ''), escapeHtml(bank_account || ''), escapeHtml(account_name || ''), escapeHtml(remark || '')).run()
    
    // 更新余额
    await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, playerId).run()
    
    // 创建流水记录
    await DB.prepare(`
      INSERT INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark, created_by)
      VALUES (?, 'withdraw', ?, ?, ?, ?, ?, 1)
    `).bind(playerId, orderNo, -withdrawAmount, balanceBefore, balanceAfter, escapeHtml(remark || '人工提款')).run()
    
    return c.json({ success: true, order_no: orderNo, message: '提款成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 提款审核操作
app.post('/api/withdrawals/:id/review', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  const { action, remark } = body
  
  try {
    const withdrawal = await DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(id).first()
    
    if (!withdrawal) {
      return c.json({ success: false, error: 'Withdrawal not found' }, 404)
    }
    
    if (action === 'approve') {
      // 获取玩家余额
      const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(withdrawal.player_id).first()
      const balanceBefore = Number(player?.balance || 0)
      const balanceAfter = balanceBefore - Number(withdrawal.amount)
      
      if (balanceAfter < 0) {
        return c.json({ success: false, error: '玩家余额不足' }, 400)
      }
      
      // 更新提款状态
      await DB.prepare(`
        UPDATE withdrawals 
        SET status = 1, reviewed_by = 1, reviewed_at = datetime('now'), remark = ?
        WHERE id = ?
      `).bind(remark || '', id).run()
      
      // 扣除余额
      await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, withdrawal.player_id).run()
      
      // 创建流水记录
      await DB.prepare(`
        INSERT INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark)
        VALUES (?, 'withdraw', ?, ?, ?, ?, ?)
      `).bind(withdrawal.player_id, withdrawal.order_no, -withdrawal.amount, balanceBefore, balanceAfter, '提款审核通过').run()
      
      return c.json({ success: true, message: '提款已批准' })
    } else if (action === 'reject') {
      await DB.prepare(`
        UPDATE withdrawals 
        SET status = 2, reviewed_by = 1, reviewed_at = datetime('now'), reject_reason = ?
        WHERE id = ?
      `).bind(remark || '', id).run()
      
      return c.json({ success: true, message: '提款已拒绝' })
    }
    
    return c.json({ success: false, error: 'Invalid action' }, 400)
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 人工调账
app.post('/api/finance/adjustment', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { player_id, amount, type, remark } = body // type: add 或 deduct
  
  // 输入验证
  const playerId = validateId(player_id)
  if (playerId === null) {
    return c.json({ success: false, error: '无效的玩家ID' }, 400)
  }
  const adjustValue = validateAmount(amount)
  if (adjustValue === null || adjustValue > 10000000) {
    return c.json({ success: false, error: '无效的调账金额' }, 400)
  }
  if (!type || !['add', 'deduct'].includes(type)) {
    return c.json({ success: false, error: '无效的调账类型' }, 400)
  }
  if (!remark || typeof remark !== 'string' || remark.length < 2) {
    return c.json({ success: false, error: '请输入调账原因' }, 400)
  }
  
  try {
    const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(playerId).first()
    if (!player) {
      return c.json({ success: false, error: '玩家不存在' }, 404)
    }
    
    const balanceBefore = Number(player.balance)
    const adjustAmount = type === 'add' ? adjustValue : -adjustValue
    const balanceAfter = balanceBefore + adjustAmount
    
    if (balanceAfter < 0) {
      return c.json({ success: false, error: '调账后余额不能为负' }, 400)
    }
    
    const orderNo = generateOrderNo('ADJ')
    
    // 更新余额
    await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, playerId).run()
    
    // 创建流水记录
    await DB.prepare(`
      INSERT INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark, created_by)
      VALUES (?, 'adjustment', ?, ?, ?, ?, ?, 1)
    `).bind(playerId, orderNo, adjustAmount, balanceBefore, balanceAfter, escapeHtml(remark)).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'finance', 'adjustment', 'player', ?, ?)
    `).bind(playerId, JSON.stringify({ type, amount: adjustValue, remark: escapeHtml(remark) })).run()
    
    return c.json({ success: true, message: '调账成功', balance_after: balanceAfter })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 资金流水查询
app.get('/api/transactions', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const playerId = validateId(c.req.query('player_id'))
  const type = c.req.query('type')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    let query = `
      SELECT t.*, p.username
      FROM transactions t
      LEFT JOIN players p ON t.player_id = p.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (playerId !== null) {
      query += ' AND t.player_id = ?'
      params.push(playerId)
    }
    
    if (type) {
      query += ' AND t.transaction_type = ?'
      params.push(type)
    }
    
    if (dateFrom) {
      query += ' AND DATE(t.created_at) >= ?'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      query += ' AND DATE(t.created_at) <= ?'
      params.push(dateTo)
    }
    
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 收款方式管理 API (V2.1.3 新增)
// ============================================

// 获取收款方式列表
app.get('/api/payment-methods', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  const type = c.req.query('type') // crypto, bank, ewallet
  const currency = c.req.query('currency')
  const includeStats = c.req.query('include_stats') === '1'
  
  try {
    let query = `
      SELECT pm.*
      FROM payment_methods pm
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== undefined && status !== '') {
      query += ' AND pm.status = ?'
      params.push(status)
    }
    
    if (type) {
      query += ' AND pm.method_type = ?'
      params.push(type)
    }
    
    if (currency) {
      query += ' AND pm.currency = ?'
      params.push(currency)
    }
    
    query += ' ORDER BY pm.display_order ASC, pm.created_at DESC'
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 如果需要统计数据
    let statsData: any[] = []
    if (includeStats) {
      const stats = await DB.prepare(`
        SELECT 
          method_id,
          SUM(deposit_count) as total_count,
          SUM(deposit_amount) as total_amount,
          SUM(success_count) as success_count,
          SUM(success_amount) as success_amount
        FROM payment_method_stats
        WHERE stat_date >= DATE('now', '-30 days')
        GROUP BY method_id
      `).all()
      statsData = stats.results
    }
    
    // 合并统计数据
    const methodsWithStats = result.results.map((method: any) => {
      const stat = statsData.find((s: any) => s.method_id === method.id)
      return {
        ...method,
        stats: stat ? {
          totalCount: stat.total_count || 0,
          totalAmount: stat.total_amount || 0,
          successCount: stat.success_count || 0,
          successAmount: stat.success_amount || 0,
          successRate: stat.total_count > 0 ? ((stat.success_count / stat.total_count) * 100).toFixed(1) : '0.0'
        } : null
      }
    })
    
    // 按类型分组统计
    const typeStats = {
      crypto: result.results.filter((m: any) => m.method_type === 'crypto').length,
      bank: result.results.filter((m: any) => m.method_type === 'bank').length,
      ewallet: result.results.filter((m: any) => m.method_type === 'ewallet').length,
      enabled: result.results.filter((m: any) => m.status === 1).length,
      disabled: result.results.filter((m: any) => m.status === 0).length
    }
    
    return c.json({
      success: true,
      data: includeStats ? methodsWithStats : result.results,
      typeStats
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取单个收款方式详情
app.get('/api/payment-methods/:id', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  try {
    const method = await DB.prepare(`
      SELECT pm.*, a.username as created_by_name
      FROM payment_methods pm
      LEFT JOIN admins a ON pm.created_by = a.id
      WHERE pm.id = ?
    `).bind(id).first()
    
    if (!method) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    // 获取近7天统计
    const stats = await DB.prepare(`
      SELECT stat_date, deposit_count, deposit_amount, success_count, success_amount
      FROM payment_method_stats
      WHERE method_id = ? AND stat_date >= DATE('now', '-7 days')
      ORDER BY stat_date DESC
    `).bind(id).all()
    
    return c.json({
      success: true,
      data: {
        ...method,
        recentStats: stats.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建收款方式
app.post('/api/payment-methods', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const {
    method_code, method_name, method_type, currency,
    account_name, account_number, bank_name, bank_branch,
    qr_code_url, min_amount, max_amount, daily_limit,
    fee_type, fee_value, exchange_rate, auto_rate,
    display_order, status, is_default, description, admin_notes
  } = body
  
  // 验证必填字段
  if (!method_code || !method_name || !method_type) {
    return c.json({ success: false, error: '方式代码、名称、类型为必填' }, 400)
  }
  
  // 验证类型
  const validTypes = ['crypto', 'bank', 'ewallet']
  if (!validTypes.includes(method_type)) {
    return c.json({ success: false, error: '无效的收款类型' }, 400)
  }
  
  try {
    // 检查代码是否重复
    const existing = await DB.prepare(
      'SELECT id FROM payment_methods WHERE method_code = ?'
    ).bind(method_code).first()
    
    if (existing) {
      return c.json({ success: false, error: '方式代码已存在' }, 400)
    }
    
    // 如果设为默认，先取消其他默认
    if (is_default) {
      await DB.prepare('UPDATE payment_methods SET is_default = 0').run()
    }
    
    const result = await DB.prepare(`
      INSERT INTO payment_methods (
        method_code, method_name, method_type, currency,
        account_name, account_number, bank_name, bank_branch,
        qr_code_url, min_amount, max_amount, daily_limit,
        fee_type, fee_value, exchange_rate, auto_rate,
        display_order, status, is_default, description, admin_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      escapeHtml(method_code), escapeHtml(method_name), method_type, currency || 'CNY',
      escapeHtml(account_name || ''), escapeHtml(account_number || ''), 
      escapeHtml(bank_name || ''), escapeHtml(bank_branch || ''),
      qr_code_url || null, min_amount || 100, max_amount || 1000000, daily_limit || null,
      fee_type || 'none', fee_value || 0, exchange_rate || null, auto_rate || 0,
      display_order || 0, status !== undefined ? status : 1, is_default || 0,
      escapeHtml(description || ''), escapeHtml(admin_notes || '')
    ).run()
    
    return c.json({
      success: true,
      message: '收款方式创建成功',
      id: result.meta.last_row_id
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新收款方式
app.put('/api/payment-methods/:id', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  const body = await c.req.json()
  
  try {
    // 检查是否存在
    const existing = await DB.prepare(
      'SELECT id FROM payment_methods WHERE id = ?'
    ).bind(id).first()
    
    if (!existing) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    // 如果修改代码，检查是否重复
    if (body.method_code) {
      const duplicate = await DB.prepare(
        'SELECT id FROM payment_methods WHERE method_code = ? AND id != ?'
      ).bind(body.method_code, id).first()
      
      if (duplicate) {
        return c.json({ success: false, error: '方式代码已存在' }, 400)
      }
    }
    
    // 如果设为默认，先取消其他默认
    if (body.is_default) {
      await DB.prepare('UPDATE payment_methods SET is_default = 0 WHERE id != ?').bind(id).run()
    }
    
    // 动态构建更新SQL
    const updates: string[] = []
    const values: any[] = []
    
    const allowedFields: Record<string, (v: any) => any> = {
      method_code: (v) => escapeHtml(v),
      method_name: (v) => escapeHtml(v),
      method_type: (v) => v,
      currency: (v) => v,
      account_name: (v) => escapeHtml(v),
      account_number: (v) => escapeHtml(v),
      bank_name: (v) => escapeHtml(v),
      bank_branch: (v) => escapeHtml(v),
      qr_code_url: (v) => v,
      min_amount: (v) => v,
      max_amount: (v) => v,
      daily_limit: (v) => v,
      fee_type: (v) => v,
      fee_value: (v) => v,
      exchange_rate: (v) => v,
      auto_rate: (v) => v,
      display_order: (v) => v,
      status: (v) => v,
      is_default: (v) => v,
      description: (v) => escapeHtml(v),
      admin_notes: (v) => escapeHtml(v),
      icon: (v) => v
    }
    
    for (const [field, transform] of Object.entries(allowedFields)) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(transform(body[field]))
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有可更新的字段' }, 400)
    }
    
    updates.push('updated_at = datetime("now")')
    values.push(id)
    
    await DB.prepare(`
      UPDATE payment_methods SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({
      success: true,
      message: '收款方式更新成功'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除收款方式
app.delete('/api/payment-methods/:id', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  try {
    // 检查是否存在
    const existing = await DB.prepare(
      'SELECT id, method_name FROM payment_methods WHERE id = ?'
    ).bind(id).first()
    
    if (!existing) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    // 检查是否有关联的存款记录
    const deposits = await DB.prepare(
      'SELECT COUNT(*) as count FROM deposits WHERE payment_method = (SELECT method_code FROM payment_methods WHERE id = ?)'
    ).bind(id).first()
    
    if (deposits && (deposits as any).count > 0) {
      // 有关联记录，只禁用不删除
      await DB.prepare('UPDATE payment_methods SET status = 0 WHERE id = ?').bind(id).run()
      return c.json({
        success: true,
        message: '该收款方式已有存款记录，已设为禁用状态'
      })
    }
    
    // 删除统计数据
    await DB.prepare('DELETE FROM payment_method_stats WHERE method_id = ?').bind(id).run()
    
    // 删除收款方式
    await DB.prepare('DELETE FROM payment_methods WHERE id = ?').bind(id).run()
    
    return c.json({
      success: true,
      message: '收款方式删除成功'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 切换收款方式状态
app.post('/api/payment-methods/:id/toggle', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  try {
    const method = await DB.prepare(
      'SELECT id, status, method_name FROM payment_methods WHERE id = ?'
    ).bind(id).first()
    
    if (!method) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    const newStatus = (method as any).status === 1 ? 0 : 1
    await DB.prepare(
      'UPDATE payment_methods SET status = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(newStatus, id).run()
    
    return c.json({
      success: true,
      message: newStatus === 1 ? '收款方式已启用' : '收款方式已禁用',
      status: newStatus
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 设为默认收款方式
app.post('/api/payment-methods/:id/set-default', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  try {
    const method = await DB.prepare(
      'SELECT id, status FROM payment_methods WHERE id = ?'
    ).bind(id).first()
    
    if (!method) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    if ((method as any).status !== 1) {
      return c.json({ success: false, error: '只能将启用状态的收款方式设为默认' }, 400)
    }
    
    // 取消所有默认
    await DB.prepare('UPDATE payment_methods SET is_default = 0').run()
    
    // 设置新默认
    await DB.prepare(
      'UPDATE payment_methods SET is_default = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run()
    
    return c.json({
      success: true,
      message: '已设为默认收款方式'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新汇率 (加密货币用)
app.post('/api/payment-methods/:id/update-rate', async (c) => {
  const { DB } = c.env
  const id = validateId(c.req.param('id'))
  if (id === null) {
    return c.json({ success: false, error: '无效的ID' }, 400)
  }
  
  const body = await c.req.json()
  const { exchange_rate } = body
  
  if (!exchange_rate || exchange_rate <= 0) {
    return c.json({ success: false, error: '无效的汇率' }, 400)
  }
  
  try {
    const method = await DB.prepare(
      'SELECT id, method_type FROM payment_methods WHERE id = ?'
    ).bind(id).first()
    
    if (!method) {
      return c.json({ success: false, error: '收款方式不存在' }, 404)
    }
    
    await DB.prepare(
      'UPDATE payment_methods SET exchange_rate = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(exchange_rate, id).run()
    
    return c.json({
      success: true,
      message: '汇率更新成功',
      exchange_rate
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 注单管理 API
// ============================================

// 注单查询
app.get('/api/bets', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const playerId = validateId(c.req.query('player_id'))
  const gameType = c.req.query('game_type')
  const status = validateStatus(c.req.query('status'))
  const tableId = validateId(c.req.query('table_id'))
  const betNoSearch = validateStringLength(c.req.query('bet_no'), 50)
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const minAmount = validateAmount(c.req.query('min_amount'))
  const maxAmount = validateAmount(c.req.query('max_amount'))
  
  try {
    let query = `
      SELECT b.*, p.username, t.table_name
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      LEFT JOIN game_tables t ON b.table_id = t.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (playerId !== null) {
      query += ' AND b.player_id = ?'
      params.push(playerId)
    }
    
    if (gameType) {
      query += ' AND b.game_type = ?'
      params.push(gameType)
    }
    
    if (status !== null) {
      query += ' AND b.status = ?'
      params.push(status)
    }
    
    if (tableId !== null) {
      query += ' AND b.table_id = ?'
      params.push(tableId)
    }
    
    if (betNoSearch) {
      query += ' AND b.bet_no LIKE ?'
      params.push(`%${betNoSearch}%`)
    }
    
    if (dateFrom) {
      query += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      query += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    if (minAmount !== null) {
      query += ' AND b.bet_amount >= ?'
      params.push(minAmount)
    }
    
    if (maxAmount !== null) {
      query += ' AND b.bet_amount <= ?'
      params.push(maxAmount)
    }
    
    query += ' ORDER BY b.bet_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计数据
    let statsQuery = 'SELECT COUNT(*) as count, SUM(bet_amount) as total_bet, SUM(profit_loss) as total_profit FROM bets WHERE 1=1'
    const statsParams: any[] = []
    
    if (playerId) {
      statsQuery += ' AND player_id = ?'
      statsParams.push(playerId)
    }
    if (dateFrom) {
      statsQuery += ' AND DATE(bet_at) >= ?'
      statsParams.push(dateFrom)
    }
    if (dateTo) {
      statsQuery += ' AND DATE(bet_at) <= ?'
      statsParams.push(dateTo)
    }
    
    const stats = await DB.prepare(statsQuery).bind(...statsParams).first()
    
    return c.json({
      success: true,
      data: result.results,
      page,
      limit,
      stats
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 实时注单监控 (注意: 必须在 /api/bets/:id 之前定义)
app.get('/api/bets/realtime', async (c) => {
  const { DB } = c.env
  
  try {
    const bets = await DB.prepare(`
      SELECT b.*, p.username, t.table_name
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      LEFT JOIN game_tables t ON b.table_id = t.id
      WHERE b.status = 0
      ORDER BY b.bet_at DESC
      LIMIT 100
    `).all()
    
    const stats = await DB.prepare(`
      SELECT COUNT(*) as count, SUM(bet_amount) as total
      FROM bets WHERE status = 0
    `).first()
    
    return c.json({ 
      success: true, 
      data: bets.results,
      stats: { count: stats?.count || 0, total: stats?.total || 0 }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 特殊注单监控 (三宝/高赔率) - 必须在 /api/bets/:id 之前
app.get('/api/bets/special', async (c) => {
  const { DB } = c.env
  
  try {
    const bets = await DB.prepare(`
      SELECT h.*, b.bet_no, b.game_type, b.bet_at, p.username
      FROM high_odds_bets h
      JOIN bets b ON h.bet_id = b.id
      JOIN players p ON h.player_id = p.id
      ORDER BY h.created_at DESC
      LIMIT 100
    `).all()
    
    return c.json({ success: true, data: bets.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 注单详情
app.get('/api/bets/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const bet = await DB.prepare(`
      SELECT b.*, p.username, p.nickname, t.table_name, t.table_code
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      LEFT JOIN game_tables t ON b.table_id = t.id
      WHERE b.id = ?
    `).bind(id).first()
    
    if (!bet) {
      return c.json({ success: false, error: 'Bet not found' }, 404)
    }
    
    // 获取同一局游戏的其他注单
    const sameBets = await DB.prepare(`
      SELECT b.*, p.username
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      WHERE b.game_round = ? AND b.id != ?
      ORDER BY b.bet_at
    `).bind(bet.game_round, id).all()
    
    return c.json({
      success: true,
      data: {
        ...bet,
        sameBets: sameBets.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 作废注单
app.post('/api/bets/:id/void', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { reason, secondary_password } = await c.req.json()
  
  // 输入验证
  const betId = validateId(id)
  if (betId === null) {
    return c.json({ success: false, error: '无效的注单ID' }, 400)
  }
  if (!reason || typeof reason !== 'string' || reason.length < 2) {
    return c.json({ success: false, error: '请输入有效的作废原因' }, 400)
  }
  
  // 验证二级密码 - 从系统配置中获取（生产环境应使用环境变量或数据库配置）
  // 此处使用哈希比对，实际密码从数据库读取
  const config = await DB.prepare('SELECT config_value FROM system_configs WHERE config_key = ?').bind('secondary_password_hash').first()
  const expectedHash = config?.config_value || 'e99a18c428cb38d5f260853678922e03abd833c8b20b27f3c5bd4d6d0b3eb2e5' // 默认为 'admin888' 的哈希
  const inputHash = await hashPassword(secondary_password)
  if (inputHash !== expectedHash) {
    return c.json({ success: false, error: '二级密码错误' }, 403)
  }
  
  try {
    const bet = await DB.prepare('SELECT * FROM bets WHERE id = ?').bind(betId).first()
    
    if (!bet) {
      return c.json({ success: false, error: 'Bet not found' }, 404)
    }
    
    if (bet.status === 2) {
      return c.json({ success: false, error: '注单已作废' }, 400)
    }
    
    // 如果已结算，需要退还金额
    if (bet.status === 1) {
      const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(bet.player_id).first()
      const balanceBefore = Number(player?.balance || 0)
      // 退还投注额 - 派彩 (反向操作)
      const refundAmount = Number(bet.bet_amount) - Number(bet.payout_amount)
      const balanceAfter = balanceBefore + refundAmount
      
      await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, bet.player_id).run()
      
      // 创建流水记录
      await DB.prepare(`
        INSERT INTO transactions (player_id, transaction_type, order_no, amount, balance_before, balance_after, remark, created_by)
        VALUES (?, 'bet', ?, ?, ?, ?, ?, 1)
      `).bind(bet.player_id, bet.bet_no, refundAmount, balanceBefore, balanceAfter, `注单作废退款: ${reason}`).run()
    }
    
    // 更新注单状态
    await DB.prepare(`
      UPDATE bets SET status = 2, voided_by = 1, voided_at = datetime('now'), void_reason = ?
      WHERE id = ?
    `).bind(reason, id).run()
    
    // 记录操作日志
    await DB.prepare(`
      INSERT INTO operation_logs (admin_id, module, action, target_type, target_id, details)
      VALUES (1, 'bets', 'void', 'bet', ?, ?)
    `).bind(id, JSON.stringify({ reason })).run()
    
    return c.json({ success: true, message: '注单已作废' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 洗码系统 API
// ============================================

// 洗码方案列表
app.get('/api/commission/schemes', async (c) => {
  const { DB } = c.env
  
  try {
    const schemes = await DB.prepare('SELECT * FROM commission_schemes ORDER BY id').all()
    
    // 获取每个方案的费率配置
    for (const scheme of schemes.results) {
      const rates = await DB.prepare('SELECT * FROM commission_rates WHERE scheme_id = ?').bind(scheme.id).all()
      ;(scheme as any).rates = rates.results
      
      // 统计绑定人数
      const boundCount = await DB.prepare('SELECT COUNT(*) as count FROM players WHERE commission_scheme_id = ?').bind(scheme.id).first()
      ;(scheme as any).bound_count = boundCount?.count || 0
    }
    
    return c.json({
      success: true,
      data: schemes.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取单个洗码方案
app.get('/api/commission/schemes/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const scheme = await DB.prepare('SELECT * FROM commission_schemes WHERE id = ?').bind(id).first()
    
    if (!scheme) {
      return c.json({ success: false, error: 'Scheme not found' }, 404)
    }
    
    const rates = await DB.prepare('SELECT * FROM commission_rates WHERE scheme_id = ?').bind(id).all()
    const boundPlayers = await DB.prepare('SELECT id, username, nickname FROM players WHERE commission_scheme_id = ?').bind(id).all()
    
    return c.json({
      success: true,
      data: {
        ...scheme,
        rates: rates.results,
        boundPlayers: boundPlayers.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建洗码方案
app.post('/api/commission/schemes', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { scheme_name, description, settle_type, min_valid_bet, max_payout, auto_settle, auto_settle_threshold, rates } = body
  
  if (!scheme_name) {
    return c.json({ success: false, error: '方案名称为必填项' }, 400)
  }
  
  try {
    // 创建方案
    const result = await DB.prepare(`
      INSERT INTO commission_schemes (scheme_name, description, settle_type, min_valid_bet, max_payout, auto_settle, auto_settle_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      scheme_name, 
      description || '', 
      settle_type || 'daily', 
      min_valid_bet || 0, 
      max_payout || 0, 
      auto_settle ? 1 : 0, 
      auto_settle_threshold || 0
    ).run()
    
    const schemeId = result.meta.last_row_id
    
    // 创建费率配置
    if (rates && rates.length > 0) {
      for (const rate of rates) {
        await DB.prepare(`
          INSERT INTO commission_rates (scheme_id, game_type, commission_rate)
          VALUES (?, ?, ?)
        `).bind(schemeId, rate.game_type, rate.commission_rate).run()
      }
    }
    
    return c.json({ success: true, id: schemeId, message: '洗码方案创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新洗码方案
app.put('/api/commission/schemes/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      scheme_name: 'scheme_name',
      description: 'description',
      settle_type: 'settle_type',
      min_valid_bet: 'min_valid_bet',
      max_payout: 'max_payout',
      auto_settle_threshold: 'auto_settle_threshold',
      status: 'status'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    // 特殊处理auto_settle布尔值
    if (body.auto_settle !== undefined) {
      updates.push('auto_settle = ?')
      values.push(body.auto_settle ? 1 : 0)
    }
    
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')")
      values.push(id)
      
      await DB.prepare(`
        UPDATE commission_schemes SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run()
    }
    
    // 更新费率配置
    if (body.rates && Array.isArray(body.rates)) {
      // 删除旧费率
      await DB.prepare('DELETE FROM commission_rates WHERE scheme_id = ?').bind(id).run()
      
      // 创建新费率
      for (const rate of body.rates) {
        await DB.prepare(`
          INSERT INTO commission_rates (scheme_id, game_type, commission_rate)
          VALUES (?, ?, ?)
        `).bind(id, rate.game_type, rate.commission_rate).run()
      }
    }
    
    return c.json({ success: true, message: '洗码方案更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 绑定洗码方案到玩家
app.post('/api/commission/bind', async (c) => {
  const { DB } = c.env
  const { player_ids, scheme_id } = await c.req.json()
  
  try {
    for (const playerId of player_ids) {
      await DB.prepare(`
        UPDATE players SET commission_scheme_id = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(scheme_id, playerId).run()
    }
    
    return c.json({ success: true, message: `已为 ${player_ids.length} 名玩家绑定洗码方案` })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 待审核洗码列表
app.get('/api/commission/pending', async (c) => {
  const { DB } = c.env
  
  try {
    const commissions = await DB.prepare(`
      SELECT cs.*, p.username, p.nickname, s.scheme_name
      FROM commission_settlements cs
      LEFT JOIN players p ON cs.player_id = p.id
      LEFT JOIN commission_schemes s ON cs.scheme_id = s.id
      WHERE cs.status = 0
      ORDER BY cs.created_at DESC
    `).all()
    
    return c.json({
      success: true,
      data: commissions.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 洗码结算列表
app.get('/api/commission/settlements', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const status = validateStatus(c.req.query('status'))
  const playerId = validateId(c.req.query('player_id'))
  
  try {
    let query = `
      SELECT cs.*, p.username, p.nickname, s.scheme_name
      FROM commission_settlements cs
      LEFT JOIN players p ON cs.player_id = p.id
      LEFT JOIN commission_schemes s ON cs.scheme_id = s.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== null) {
      query += ' AND cs.status = ?'
      params.push(status)
    }
    
    if (playerId !== null) {
      query += ' AND cs.player_id = ?'
      params.push(playerId)
    }
    
    query += ' ORDER BY cs.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 审核洗码
app.post('/api/commission/:id/review', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { action, remark } = await c.req.json()
  
  try {
    const settlement = await DB.prepare('SELECT * FROM commission_settlements WHERE id = ?').bind(id).first()
    
    if (!settlement) {
      return c.json({ success: false, error: 'Settlement not found' }, 404)
    }
    
    if (action === 'approve') {
      // 获取玩家余额
      const player = await DB.prepare('SELECT balance FROM players WHERE id = ?').bind(settlement.player_id).first()
      const balanceBefore = Number(player?.balance || 0)
      const balanceAfter = balanceBefore + Number(settlement.commission_amount)
      
      // 更新洗码状态
      await DB.prepare(`
        UPDATE commission_settlements 
        SET status = 1, reviewed_by = 1, reviewed_at = datetime('now'), settled_at = datetime('now'), remark = ?
        WHERE id = ?
      `).bind(remark || '', id).run()
      
      // 发放洗码
      await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(balanceAfter, settlement.player_id).run()
      
      // 创建流水记录
      await DB.prepare(`
        INSERT INTO transactions (player_id, transaction_type, amount, balance_before, balance_after, remark)
        VALUES (?, 'commission', ?, ?, ?, ?)
      `).bind(settlement.player_id, settlement.commission_amount, balanceBefore, balanceAfter, '洗码发放').run()
      
      return c.json({ success: true, message: '洗码已发放' })
    } else if (action === 'reject') {
      await DB.prepare(`
        UPDATE commission_settlements 
        SET status = 2, reviewed_by = 1, reviewed_at = datetime('now'), remark = ?
        WHERE id = ?
      `).bind(remark || '', id).run()
      
      return c.json({ success: true, message: '洗码已拒绝' })
    }
    
    return c.json({ success: false, error: 'Invalid action' }, 400)
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 手动生成洗码结算
app.post('/api/commission/generate', async (c) => {
  const { DB } = c.env
  const { player_id, date_from, date_to } = await c.req.json()
  
  try {
    // 获取玩家的洗码方案
    const player = await DB.prepare('SELECT commission_scheme_id FROM players WHERE id = ?').bind(player_id).first()
    
    if (!player?.commission_scheme_id) {
      return c.json({ success: false, error: '玩家未绑定洗码方案' }, 400)
    }
    
    // 获取方案费率
    const rates = await DB.prepare('SELECT * FROM commission_rates WHERE scheme_id = ?').bind(player.commission_scheme_id).all()
    
    // 计算有效投注
    const bets = await DB.prepare(`
      SELECT game_type, SUM(valid_bet) as total_valid_bet
      FROM bets
      WHERE player_id = ? AND DATE(bet_at) >= ? AND DATE(bet_at) <= ? AND status = 1
      GROUP BY game_type
    `).bind(player_id, date_from, date_to).all()
    
    let totalCommission = 0
    const details: any[] = []
    
    for (const bet of bets.results) {
      const rate = rates.results.find((r: any) => r.game_type === bet.game_type)
      if (rate) {
        const commission = Number(bet.total_valid_bet) * Number(rate.commission_rate)
        totalCommission += commission
        details.push({
          game_type: bet.game_type,
          valid_bet: bet.total_valid_bet,
          rate: rate.commission_rate,
          commission
        })
      }
    }
    
    if (totalCommission > 0) {
      // 创建结算记录
      await DB.prepare(`
        INSERT INTO commission_settlements (player_id, scheme_id, period_start, period_end, valid_bet, commission_rate, commission_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        player_id, 
        player.commission_scheme_id, 
        date_from, 
        date_to, 
        bets.results.reduce((sum: number, b: any) => sum + Number(b.total_valid_bet), 0),
        0, // 平均费率
        totalCommission
      ).run()
      
      return c.json({ 
        success: true, 
        message: '洗码结算已生成',
        data: { totalCommission, details }
      })
    } else {
      return c.json({ success: false, error: '该周期内无有效投注' }, 400)
    }
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 风险控制 API
// ============================================

// 风险预警列表
app.get('/api/risk/alerts', async (c) => {
  const { DB } = c.env
  const status = validateStatus(c.req.query('status'))
  const alertType = c.req.query('alert_type')
  const severity = c.req.query('severity')
  const { limit } = validatePagination('1', c.req.query('limit'))
  
  try {
    let query = `
      SELECT ra.*, p.username, t.table_name
      FROM risk_alerts ra
      LEFT JOIN players p ON ra.player_id = p.id
      LEFT JOIN game_tables t ON ra.table_id = t.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== null) {
      query += ' AND ra.status = ?'
      params.push(status)
    }
    
    if (alertType) {
      query += ' AND ra.alert_type = ?'
      params.push(alertType)
    }
    
    if (severity) {
      query += ' AND ra.severity = ?'
      params.push(severity)
    }
    
    query += ' ORDER BY ra.created_at DESC LIMIT ?'
    params.push(limit)
    
    const alerts = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: alerts.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 处理风险预警
app.post('/api/risk/alerts/:id/handle', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { action, notes } = await c.req.json()
  
  try {
    const alert = await DB.prepare('SELECT * FROM risk_alerts WHERE id = ?').bind(id).first()
    
    if (!alert) {
      return c.json({ success: false, error: 'Alert not found' }, 404)
    }
    
    // 更新预警状态
    await DB.prepare(`
      UPDATE risk_alerts 
      SET status = ?, handled_by = 1, handled_at = datetime('now'), handle_action = ?, notes = ?
      WHERE id = ?
    `).bind(action === 'ignore' ? 2 : 1, action, notes, id).run()
    
    // 根据action执行相应操作
    if (action === 'lock' && alert.player_id) {
      await DB.prepare('UPDATE players SET status = 2 WHERE id = ?').bind(alert.player_id).run()
    }
    
    return c.json({ success: true, message: '预警已处理' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建风险预警 (手动)
app.post('/api/risk/alerts', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { alert_type, severity, player_id, table_id, alert_data } = body
  
  try {
    const result = await DB.prepare(`
      INSERT INTO risk_alerts (alert_type, severity, player_id, table_id, alert_data)
      VALUES (?, ?, ?, ?, ?)
    `).bind(alert_type, severity || 'medium', player_id, table_id, JSON.stringify(alert_data)).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '风险预警已创建' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 限红配置列表
app.get('/api/risk/limits', async (c) => {
  const { DB } = c.env
  
  try {
    const limits = await DB.prepare('SELECT * FROM limit_configs ORDER BY game_type, config_name').all()
    
    return c.json({
      success: true,
      data: limits.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建/更新限红配置
app.post('/api/risk/limits', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { id, config_name, game_type, min_bet, max_bet, max_payout, daily_max_win } = body
  
  if (!config_name || !game_type) {
    return c.json({ success: false, error: '配置名称和游戏类型为必填项' }, 400)
  }
  
  try {
    if (id) {
      await DB.prepare(`
        UPDATE limit_configs 
        SET config_name = ?, game_type = ?, min_bet = ?, max_bet = ?, max_payout = ?, daily_max_win = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(config_name, game_type, min_bet || 0, max_bet || 0, max_payout || 0, daily_max_win || 0, id).run()
      
      return c.json({ success: true, message: '限红配置已更新' })
    } else {
      const result = await DB.prepare(`
        INSERT INTO limit_configs (config_name, game_type, min_bet, max_bet, max_payout, daily_max_win)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(config_name, game_type, min_bet || 0, max_bet || 0, max_payout || 0, daily_max_win || 0).run()
      
      return c.json({ success: true, id: result.meta.last_row_id, message: '限红配置已创建' })
    }
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 现场运营 API
// ============================================

// 荷官列表
app.get('/api/dealers', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  
  try {
    let query = 'SELECT * FROM dealers WHERE 1=1'
    const params: any[] = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    query += ' ORDER BY status, id'
    
    const dealers = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: dealers.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 荷官详情
app.get('/api/dealers/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const dealer = await DB.prepare('SELECT * FROM dealers WHERE id = ?').bind(id).first()
    
    if (!dealer) {
      return c.json({ success: false, error: 'Dealer not found' }, 404)
    }
    
    const shifts = await DB.prepare(`
      SELECT ds.*, t.table_name
      FROM dealer_shifts ds
      LEFT JOIN game_tables t ON ds.table_id = t.id
      WHERE ds.dealer_id = ?
      ORDER BY ds.shift_date DESC, ds.start_time DESC
      LIMIT 30
    `).bind(id).all()
    
    return c.json({
      success: true,
      data: {
        ...dealer,
        shifts: shifts.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建荷官
app.post('/api/dealers', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { employee_no, stage_name, stage_name_en, real_name, gender, phone, email } = body
  
  if (!employee_no || !stage_name) {
    return c.json({ success: false, error: '工号和艺名为必填项' }, 400)
  }
  
  try {
    const existing = await DB.prepare('SELECT id FROM dealers WHERE employee_no = ?').bind(employee_no).first()
    if (existing) {
      return c.json({ success: false, error: '工号已存在' }, 400)
    }
    
    const result = await DB.prepare(`
      INSERT INTO dealers (employee_no, stage_name, stage_name_en, real_name, gender, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(employee_no, stage_name, stage_name_en || '', real_name || '', gender || 'F', phone || '', email || '').run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '荷官创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新荷官
app.put('/api/dealers/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      stage_name: 'stage_name',
      stage_name_en: 'stage_name_en',
      real_name: 'real_name',
      gender: 'gender',
      phone: 'phone',
      email: 'email',
      status: 'status',
      rating: 'rating',
      notes: 'notes'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE dealers SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '荷官信息更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 桌台列表
app.get('/api/tables', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  const gameType = c.req.query('game_type')
  
  try {
    let query = `
      SELECT t.*, d.stage_name as dealer_name
      FROM game_tables t
      LEFT JOIN dealers d ON t.current_dealer_id = d.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status) {
      query += ' AND t.status = ?'
      params.push(status)
    }
    
    if (gameType) {
      query += ' AND t.game_type = ?'
      params.push(gameType)
    }
    
    query += ' ORDER BY t.game_type, t.table_code'
    
    const tables = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: tables.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建桌台
app.post('/api/tables', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { table_code, game_type, table_name, min_bet, max_bet, limit_group, video_stream_main, video_stream_backup } = body
  
  if (!table_code || !table_name || !game_type) {
    return c.json({ success: false, error: '桌台编号、名称和游戏类型为必填项' }, 400)
  }
  
  try {
    const existing = await DB.prepare('SELECT id FROM game_tables WHERE table_code = ?').bind(table_code).first()
    if (existing) {
      return c.json({ success: false, error: '桌台编号已存在' }, 400)
    }
    
    const result = await DB.prepare(`
      INSERT INTO game_tables (table_code, game_type, table_name, min_bet, max_bet, limit_group, video_stream_main, video_stream_backup)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(table_code, game_type, table_name, min_bet || 0, max_bet || 0, limit_group || 'A', video_stream_main || '', video_stream_backup || '').run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '桌台创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新桌台
app.put('/api/tables/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      table_name: 'table_name',
      min_bet: 'min_bet',
      max_bet: 'max_bet',
      limit_group: 'limit_group',
      video_stream_main: 'video_stream_main',
      video_stream_backup: 'video_stream_backup',
      status: 'status',
      current_dealer_id: 'current_dealer_id'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE game_tables SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '桌台信息更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 排班查询
app.get('/api/shifts', async (c) => {
  const { DB } = c.env
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]
  const dealerId = c.req.query('dealer_id')
  const tableId = c.req.query('table_id')
  
  try {
    let query = `
      SELECT s.*, d.stage_name, d.employee_no, t.table_name, t.table_code
      FROM dealer_shifts s
      LEFT JOIN dealers d ON s.dealer_id = d.id
      LEFT JOIN game_tables t ON s.table_id = t.id
      WHERE s.shift_date = ?
    `
    const params: any[] = [date]
    
    if (dealerId) {
      query += ' AND s.dealer_id = ?'
      params.push(dealerId)
    }
    
    if (tableId) {
      query += ' AND s.table_id = ?'
      params.push(tableId)
    }
    
    query += ' ORDER BY s.start_time'
    
    const shifts = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: shifts.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建排班
app.post('/api/shifts', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { dealer_id, table_id, shift_date, start_time, end_time, notes = '' } = body
  
  // 参数验证
  if (!dealer_id || !table_id || !shift_date || !start_time || !end_time) {
    return c.json({ success: false, error: '缺少必填字段：dealer_id, table_id, shift_date, start_time, end_time' }, 400)
  }
  
  try {
    // 检查冲突
    const conflict = await DB.prepare(`
      SELECT id FROM dealer_shifts 
      WHERE dealer_id = ? AND shift_date = ? AND status != 4
      AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
    `).bind(dealer_id, shift_date, start_time, start_time, end_time, end_time).first()
    
    if (conflict) {
      return c.json({ success: false, error: '排班时间冲突' }, 400)
    }
    
    const result = await DB.prepare(`
      INSERT INTO dealer_shifts (dealer_id, table_id, shift_date, start_time, end_time, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(dealer_id, table_id, shift_date, start_time, end_time, notes || '').run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '排班创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新排班
app.put('/api/shifts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      dealer_id: 'dealer_id',
      table_id: 'table_id',
      shift_date: 'shift_date',
      start_time: 'start_time',
      end_time: 'end_time',
      status: 'status',
      notes: 'notes'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE dealer_shifts SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '排班更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除排班
app.delete('/api/shifts/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('UPDATE dealer_shifts SET status = 4 WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '排班已取消' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 报表中心 API
// ============================================

// 每日汇总报表
app.get('/api/reports/daily', async (c) => {
  const { DB } = c.env
  const date = c.req.query('date') || new Date().toISOString().split('T')[0]
  
  try {
    // 投注统计
    const betStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_bets,
        SUM(bet_amount) as total_bet_amount,
        SUM(valid_bet) as total_valid_bet,
        SUM(payout_amount) as total_payout,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as platform_win,
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as platform_loss
      FROM bets WHERE DATE(bet_at) = ?
    `).bind(date).first()
    
    // 存款统计
    const depositStats = await DB.prepare(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM deposits WHERE DATE(created_at) = ? AND status = 1
    `).bind(date).first()
    
    // 提款统计
    const withdrawalStats = await DB.prepare(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM withdrawals WHERE DATE(created_at) = ? AND status IN (1, 4)
    `).bind(date).first()
    
    // 新增玩家
    const newPlayers = await DB.prepare(`
      SELECT COUNT(*) as count FROM players WHERE DATE(created_at) = ?
    `).bind(date).first()
    
    // 活跃玩家
    const activePlayers = await DB.prepare(`
      SELECT COUNT(DISTINCT player_id) as count FROM bets WHERE DATE(bet_at) = ?
    `).bind(date).first()
    
    // 游戏类型分布
    const gameDistribution = await DB.prepare(`
      SELECT game_type, COUNT(*) as bet_count, SUM(bet_amount) as bet_amount, 
             SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END) as profit
      FROM bets WHERE DATE(bet_at) = ?
      GROUP BY game_type
    `).bind(date).all()
    
    return c.json({
      success: true,
      data: {
        date,
        betStats,
        depositStats,
        withdrawalStats,
        newPlayers: newPlayers?.count || 0,
        activePlayers: activePlayers?.count || 0,
        gameDistribution: gameDistribution.results,
        netProfit: (Number(betStats?.platform_win || 0) - Number(betStats?.platform_loss || 0))
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 综合报表概览
app.get('/api/reports/summary', async (c) => {
  const { DB } = c.env
  const period = c.req.query('period') || 'today'
  
  try {
    // 根据时间范围确定日期
    let dateCondition = "DATE(created_at) = DATE('now')"
    if (period === 'week') {
      dateCondition = "DATE(created_at) >= DATE('now', '-7 days')"
    } else if (period === 'month') {
      dateCondition = "DATE(created_at) >= DATE('now', '-30 days')"
    }
    
    // 获取玩家统计
    const playerStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(CASE WHEN ${dateCondition} THEN 1 END) as new_players
      FROM players
    `).first()
    
    // 获取投注统计
    const betStats = await DB.prepare(`
      SELECT 
        COUNT(*) as bet_count,
        COALESCE(SUM(bet_amount), 0) as total_bet,
        COALESCE(SUM(valid_bet), 0) as valid_bet,
        COALESCE(SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END), 0) as platform_profit
      FROM bets 
      WHERE ${dateCondition.replace('created_at', 'bet_at')}
    `).first()
    
    // 获取财务统计
    const financeStats = await DB.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposit,
        COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawal,
        COUNT(CASE WHEN transaction_type = 'deposit' THEN 1 END) as deposit_count,
        COUNT(CASE WHEN transaction_type = 'withdrawal' THEN 1 END) as withdrawal_count
      FROM transactions
      WHERE ${dateCondition}
    `).first()
    
    return c.json({
      success: true,
      data: {
        period,
        players: playerStats,
        bets: betStats,
        finance: financeStats
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 盈亏分析报表
app.get('/api/reports/profit', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateTo = c.req.query('date_to') || new Date().toISOString().split('T')[0]
  
  try {
    // 每日盈亏趋势
    const dailyProfit = await DB.prepare(`
      SELECT 
        DATE(bet_at) as date,
        SUM(bet_amount) as bet_amount,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END) as profit
      FROM bets 
      WHERE DATE(bet_at) >= ? AND DATE(bet_at) <= ?
      GROUP BY DATE(bet_at)
      ORDER BY date
    `).bind(dateFrom, dateTo).all()
    
    // 汇总
    const summary = await DB.prepare(`
      SELECT 
        SUM(bet_amount) as total_bet,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as total_win,
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as total_loss
      FROM bets 
      WHERE DATE(bet_at) >= ? AND DATE(bet_at) <= ?
    `).bind(dateFrom, dateTo).first()
    
    return c.json({
      success: true,
      data: {
        dateFrom,
        dateTo,
        dailyProfit: dailyProfit.results,
        summary
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 盈利榜/亏损榜 (玩家排名)
app.get('/api/reports/ranking', async (c) => {
  const { DB } = c.env
  const type = c.req.query('type') || 'profit' // profit(盈利榜) or loss(亏损榜)
  const limit = parseInt(c.req.query('limit') || '50')
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    let dateCondition = ''
    const params: any[] = []
    
    if (dateFrom) {
      dateCondition += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    // 玩家盈亏排名 (profit_loss > 0 表示玩家赢, < 0 表示玩家输)
    const orderBy = type === 'profit' 
      ? 'player_profit DESC' // 玩家赢的钱排序
      : 'player_loss DESC'   // 玩家输的钱排序
    
    const query = `
      SELECT 
        p.id, p.username, p.nickname, p.vip_level, p.balance,
        a.username as agent_name,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet), 0) as total_valid_bet,
        COALESCE(SUM(CASE WHEN b.profit_loss > 0 THEN b.profit_loss ELSE 0 END), 0) as player_profit,
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE 0 END), 0) as player_loss,
        COALESCE(SUM(b.profit_loss), 0) as net_profit_loss
      FROM players p
      LEFT JOIN bets b ON p.id = b.player_id ${dateCondition}
      LEFT JOIN agents a ON p.agent_id = a.id
      GROUP BY p.id
      HAVING ${type === 'profit' ? 'player_profit > 0' : 'player_loss > 0'}
      ORDER BY ${orderBy}
      LIMIT ?
    `
    params.push(limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总统计
    const summary = await DB.prepare(`
      SELECT 
        COUNT(DISTINCT player_id) as player_count,
        SUM(bet_amount) as total_bet,
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as total_player_profit,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as total_player_loss
      FROM bets
      WHERE 1=1 ${dateCondition.replace(/b\./g, '')}
    `).bind(...params.slice(0, -1)).first()
    
    return c.json({
      success: true,
      data: {
        type,
        ranking: result.results,
        summary: {
          playerCount: summary?.player_count || 0,
          totalBet: summary?.total_bet || 0,
          totalPlayerProfit: summary?.total_player_profit || 0,
          totalPlayerLoss: summary?.total_player_loss || 0,
          companyProfit: (summary?.total_player_loss || 0) - (summary?.total_player_profit || 0)
        }
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 代理报表
app.get('/api/reports/agents', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    let query = `
      SELECT 
        a.id, a.username, a.agent_level,
        COUNT(DISTINCT p.id) as player_count,
        COUNT(b.id) as bet_count,
        SUM(b.bet_amount) as total_bet,
        SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE -b.profit_loss END) as profit
      FROM agents a
      LEFT JOIN players p ON p.agent_id = a.id
      LEFT JOIN bets b ON b.player_id = p.id
    `
    
    const params: any[] = []
    
    if (dateFrom && dateTo) {
      query += ' AND DATE(b.bet_at) >= ? AND DATE(b.bet_at) <= ?'
      params.push(dateFrom, dateTo)
    }
    
    query += ' GROUP BY a.id ORDER BY profit DESC'
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 完善报表 API - 股东/代理/游戏/区域报表
// ============================================

// 股东报表 (顶级代理视为股东)
app.get('/api/reports/shareholder', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const shareholderId = c.req.query('shareholder_id')
  
  try {
    let dateCondition = ''
    const params: any[] = []
    
    if (dateFrom) {
      dateCondition += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    let shareholderCondition = ''
    if (shareholderId) {
      shareholderCondition = ' AND a.id = ?'
      params.push(shareholderId)
    }
    
    // 获取股东(顶级代理)报表
    const query = `
      SELECT 
        a.id as shareholder_id,
        a.username as shareholder_name,
        a.commission_rate as profit_share,
        COUNT(DISTINCT p.id) as total_players,
        COUNT(DISTINCT CASE WHEN DATE(p.created_at) >= DATE('now', '-7 days') THEN p.id END) as new_players,
        COUNT(DISTINCT sub_a.id) as sub_agent_count,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet), 0) as valid_bet,
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE 0 END), 0) as player_loss,
        COALESCE(SUM(CASE WHEN b.profit_loss > 0 THEN b.profit_loss ELSE 0 END), 0) as player_win,
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE -b.profit_loss END), 0) as company_profit,
        COALESCE(SUM(b.valid_bet) * a.commission_rate / 100, 0) as commission
      FROM agents a
      LEFT JOIN agents sub_a ON sub_a.parent_id = a.id
      LEFT JOIN players p ON p.agent_id = a.id OR p.agent_id IN (SELECT id FROM agents WHERE parent_id = a.id)
      LEFT JOIN bets b ON b.player_id = p.id ${dateCondition}
      WHERE a.agent_level = 1 ${shareholderCondition}
      GROUP BY a.id
      ORDER BY company_profit DESC
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总统计
    const summary = await DB.prepare(`
      SELECT 
        COUNT(DISTINCT CASE WHEN agent_level = 1 THEN id END) as shareholder_count,
        COUNT(DISTINCT CASE WHEN agent_level > 1 THEN id END) as agent_count
      FROM agents
    `).first()
    
    return c.json({
      success: true,
      data: {
        shareholders: result.results,
        summary: {
          shareholderCount: summary?.shareholder_count || 0,
          agentCount: summary?.agent_count || 0
        }
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 游戏报表
app.get('/api/reports/games', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const gameType = c.req.query('game_type')
  
  try {
    let dateCondition = ''
    const params: any[] = []
    
    if (dateFrom) {
      dateCondition += ' AND DATE(bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(bet_at) <= ?'
      params.push(dateTo)
    }
    
    let gameCondition = ''
    if (gameType) {
      gameCondition = ' AND game_type = ?'
      params.push(gameType)
    }
    
    // 按游戏类型汇总
    const byGame = await DB.prepare(`
      SELECT 
        game_type,
        COUNT(*) as bet_count,
        COUNT(DISTINCT player_id) as player_count,
        SUM(bet_amount) as total_bet,
        SUM(valid_bet) as valid_bet,
        SUM(payout_amount) as total_payout,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as player_loss,
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as player_win,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END) as company_profit,
        AVG(bet_amount) as avg_bet,
        MAX(bet_amount) as max_bet
      FROM bets
      WHERE 1=1 ${dateCondition} ${gameCondition}
      GROUP BY game_type
      ORDER BY total_bet DESC
    `).bind(...params).all()
    
    // 按桌台统计
    const byTable = await DB.prepare(`
      SELECT 
        b.table_id,
        t.table_name,
        t.game_type,
        COUNT(*) as bet_count,
        COUNT(DISTINCT player_id) as player_count,
        SUM(b.bet_amount) as total_bet,
        SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE -b.profit_loss END) as company_profit
      FROM bets b
      LEFT JOIN game_tables t ON b.table_id = t.id
      WHERE 1=1 ${dateCondition} ${gameCondition.replace('game_type', 't.game_type')}
      GROUP BY b.table_id
      ORDER BY total_bet DESC
      LIMIT 20
    `).bind(...params).all()
    
    // 投注类型分布
    const byBetType = await DB.prepare(`
      SELECT 
        bet_type,
        game_type,
        COUNT(*) as bet_count,
        SUM(bet_amount) as total_bet,
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END) as company_profit
      FROM bets
      WHERE 1=1 ${dateCondition} ${gameCondition}
      GROUP BY bet_type, game_type
      ORDER BY total_bet DESC
    `).bind(...params).all()
    
    return c.json({
      success: true,
      data: {
        byGame: byGame.results,
        byTable: byTable.results,
        byBetType: byBetType.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 会员盈亏报表 (详细)
app.get('/api/reports/players', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const agentId = validateId(c.req.query('agent_id'))
  const username = validateStringLength(c.req.query('username'), 50)
  const minBetVal = validateAmount(c.req.query('min_bet'))
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  
  // 验证日期格式 (YYYY-MM-DD)
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  const validDateFrom = dateFrom && datePattern.test(dateFrom) ? dateFrom : null
  const validDateTo = dateTo && datePattern.test(dateTo) ? dateTo : null
  
  try {
    // 构建日期条件 - 使用字面量（已验证格式安全）
    let betDateCondition = ''
    let depositDateCondition = ''
    let withdrawalDateCondition = ''
    
    if (validDateFrom) {
      betDateCondition += ` AND DATE(b.bet_at) >= '${validDateFrom}'`
      depositDateCondition += ` AND DATE(created_at) >= '${validDateFrom}'`
      withdrawalDateCondition += ` AND DATE(created_at) >= '${validDateFrom}'`
    }
    if (validDateTo) {
      betDateCondition += ` AND DATE(b.bet_at) <= '${validDateTo}'`
      depositDateCondition += ` AND DATE(created_at) <= '${validDateTo}'`
      withdrawalDateCondition += ` AND DATE(created_at) <= '${validDateTo}'`
    }
    
    // 构建玩家条件
    const playerParams: any[] = []
    let playerCondition = ''
    if (agentId !== null) {
      playerCondition += ' AND p.agent_id = ?'
      playerParams.push(agentId)
    }
    if (username) {
      playerCondition += ' AND p.username LIKE ?'
      playerParams.push(`%${username}%`)
    }
    
    // 构建HAVING条件
    let havingCondition = ''
    if (minBetVal !== null) {
      havingCondition = ` HAVING total_bet >= ${minBetVal}` // 已通过validateAmount验证
    }
    
    const query = `
      SELECT 
        p.id as player_id,
        p.username,
        p.nickname,
        p.vip_level,
        p.balance,
        a.username as agent_name,
        COUNT(b.id) as bet_count,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COALESCE(SUM(b.valid_bet), 0) as valid_bet,
        COALESCE(SUM(b.payout_amount), 0) as total_payout,
        COALESCE(SUM(CASE WHEN b.profit_loss > 0 THEN b.profit_loss ELSE 0 END), 0) as player_win,
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE 0 END), 0) as player_loss,
        COALESCE(SUM(b.profit_loss), 0) as net_profit,
        COALESCE((SELECT SUM(amount) FROM deposits WHERE player_id = p.id AND status = 1 ${depositDateCondition}), 0) as total_deposit,
        COALESCE((SELECT SUM(amount) FROM withdrawals WHERE player_id = p.id AND status IN (1, 4) ${withdrawalDateCondition}), 0) as total_withdrawal
      FROM players p
      LEFT JOIN bets b ON b.player_id = p.id ${betDateCondition}
      LEFT JOIN agents a ON p.agent_id = a.id
      WHERE 1=1 ${playerCondition}
      GROUP BY p.id
      ${havingCondition}
      ORDER BY total_bet DESC
      LIMIT ? OFFSET ?
    `
    
    // 添加分页参数
    const queryParams = [...playerParams, limit, (page - 1) * limit]
    
    const result = await DB.prepare(query).bind(...queryParams).all()
    
    // 总计
    const total = await DB.prepare(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM players p
      LEFT JOIN bets b ON b.player_id = p.id ${betDateCondition}
      WHERE 1=1 ${playerCondition}
    `).bind(...playerParams).first()
    
    return c.json({
      success: true,
      data: result.results,
      pagination: {
        page,
        limit,
        total: total?.count || 0
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 佣金结算报表
app.get('/api/reports/commission', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const status = c.req.query('status')
  const schemeId = c.req.query('scheme_id')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (dateFrom) {
      conditions += ' AND DATE(c.period_start) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions += ' AND DATE(c.period_end) <= ?'
      params.push(dateTo)
    }
    if (status !== undefined && status !== '') {
      conditions += ' AND c.status = ?'
      params.push(status)
    }
    if (schemeId) {
      conditions += ' AND c.scheme_id = ?'
      params.push(schemeId)
    }
    
    const query = `
      SELECT 
        c.*,
        p.username,
        p.nickname,
        p.vip_level,
        s.scheme_name,
        a.username as agent_name
      FROM commission_settlements c
      LEFT JOIN players p ON c.player_id = p.id
      LEFT JOIN commission_schemes s ON c.scheme_id = s.id
      LEFT JOIN agents a ON p.agent_id = a.id
      WHERE 1=1 ${conditions}
      ORDER BY c.created_at DESC
      LIMIT 200
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总
    const summary = await DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(valid_bet) as total_valid_bet,
        SUM(commission_amount) as total_commission,
        SUM(CASE WHEN status = 0 THEN commission_amount ELSE 0 END) as pending_commission,
        SUM(CASE WHEN status = 1 THEN commission_amount ELSE 0 END) as approved_commission
      FROM commission_settlements c
      WHERE 1=1 ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      summary
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 导出 API
// ============================================

// 注单导出
app.get('/api/exports/bets', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const playerId = c.req.query('player_id')
  const gameType = c.req.query('game_type')
  const status = c.req.query('status')
  const agentId = c.req.query('agent_id')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (dateFrom) {
      conditions += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    if (playerId) {
      conditions += ' AND b.player_id = ?'
      params.push(playerId)
    }
    if (gameType) {
      conditions += ' AND b.game_type = ?'
      params.push(gameType)
    }
    if (status !== undefined && status !== '') {
      conditions += ' AND b.status = ?'
      params.push(status)
    }
    if (agentId) {
      conditions += ' AND p.agent_id = ?'
      params.push(agentId)
    }
    
    const query = `
      SELECT 
        b.bet_no as '注单号',
        p.username as '会员账号',
        a.username as '代理账号',
        CASE b.game_type 
          WHEN 'baccarat' THEN '百家乐'
          WHEN 'dragon_tiger' THEN '龙虎'
          WHEN 'roulette' THEN '轮盘'
          WHEN 'sicbo' THEN '骰宝'
          WHEN 'bull_bull' THEN '牛牛'
          ELSE b.game_type
        END as '游戏类型',
        t.table_name as '桌台',
        b.bet_type as '投注项',
        b.bet_amount as '投注金额',
        b.valid_bet as '有效投注',
        b.payout_amount as '派彩金额',
        b.profit_loss as '盈亏',
        CASE b.status WHEN 0 THEN '未结算' WHEN 1 THEN '已结算' WHEN 2 THEN '已作废' ELSE '未知' END as '状态',
        b.bet_at as '投注时间',
        b.settled_at as '结算时间'
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      LEFT JOIN agents a ON p.agent_id = a.id
      LEFT JOIN game_tables t ON b.table_id = t.id
      WHERE 1=1 ${conditions}
      ORDER BY b.bet_at DESC
      LIMIT 10000
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总统计
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(bet_amount) as total_bet,
        SUM(valid_bet) as total_valid_bet,
        SUM(payout_amount) as total_payout,
        SUM(profit_loss) as total_profit
      FROM bets b
      LEFT JOIN players p ON b.player_id = p.id
      WHERE 1=1 ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 财务记录导出 (充值/提款)
app.get('/api/exports/finance', async (c) => {
  const { DB } = c.env
  const type = c.req.query('type') || 'all' // deposit, withdrawal, all
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const status = c.req.query('status')
  const username = c.req.query('username')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (dateFrom) {
      conditions += ' AND DATE(t.created_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions += ' AND DATE(t.created_at) <= ?'
      params.push(dateTo)
    }
    if (username) {
      conditions += ' AND p.username LIKE ?'
      params.push(`%${username}%`)
    }
    
    let typeCondition = ''
    if (type === 'deposit') {
      typeCondition = " AND t.transaction_type = 'deposit'"
    } else if (type === 'withdrawal') {
      typeCondition = " AND t.transaction_type = 'withdraw'"
    } else {
      typeCondition = " AND t.transaction_type IN ('deposit', 'withdraw')"
    }
    
    if (status !== undefined && status !== '') {
      conditions += ' AND t.status = ?'
      params.push(status)
    }
    
    const query = `
      SELECT 
        t.order_no as '订单号',
        p.username as '会员账号',
        a.username as '代理账号',
        CASE t.transaction_type WHEN 'deposit' THEN '充值' WHEN 'withdraw' THEN '提款' ELSE t.transaction_type END as '类型',
        t.amount as '金额',
        t.balance_before as '操作前余额',
        t.balance_after as '操作后余额',
        t.remark as '备注',
        t.created_at as '创建时间'
      FROM transactions t
      LEFT JOIN players p ON t.player_id = p.id
      LEFT JOIN agents ag ON p.agent_id = ag.id
      LEFT JOIN agents a ON p.agent_id = a.id
      WHERE 1=1 ${typeCondition} ${conditions}
      ORDER BY t.created_at DESC
      LIMIT 10000
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总
    const stats = await DB.prepare(`
      SELECT 
        COUNT(CASE WHEN transaction_type = 'deposit' THEN 1 END) as deposit_count,
        SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposit,
        COUNT(CASE WHEN transaction_type = 'withdraw' THEN 1 END) as withdrawal_count,
        SUM(CASE WHEN transaction_type = 'withdraw' THEN amount ELSE 0 END) as total_withdrawal
      FROM transactions t
      LEFT JOIN players p ON t.player_id = p.id
      WHERE 1=1 ${typeCondition} ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 会员报表导出
app.get('/api/exports/players', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const agentId = c.req.query('agent_id')
  
  try {
    let dateCondition = ''
    const params: any[] = []
    
    if (dateFrom) {
      dateCondition += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    let agentCondition = ''
    if (agentId) {
      agentCondition = ' AND p.agent_id = ?'
      params.push(agentId)
    }
    
    const query = `
      SELECT 
        p.username as '会员账号',
        p.nickname as '昵称',
        a.username as '代理账号',
        p.vip_level as 'VIP等级',
        p.balance as '当前余额',
        COUNT(b.id) as '投注笔数',
        COALESCE(SUM(b.bet_amount), 0) as '总投注额',
        COALESCE(SUM(b.valid_bet), 0) as '有效投注',
        COALESCE(SUM(CASE WHEN b.profit_loss > 0 THEN b.profit_loss ELSE 0 END), 0) as '会员盈利',
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE 0 END), 0) as '会员亏损',
        COALESCE(SUM(b.profit_loss), 0) as '净盈亏',
        (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE player_id = p.id AND status = 1) as '总充值',
        (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE player_id = p.id AND status IN (1, 4)) as '总提款',
        p.created_at as '注册时间',
        p.last_login_at as '最后登录'
      FROM players p
      LEFT JOIN bets b ON b.player_id = p.id ${dateCondition}
      LEFT JOIN agents a ON p.agent_id = a.id
      WHERE 1=1 ${agentCondition}
      GROUP BY p.id
      ORDER BY SUM(b.bet_amount) DESC
      LIMIT 5000
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 代理报表导出
app.get('/api/exports/agents', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    let dateCondition = ''
    const params: any[] = []
    
    if (dateFrom) {
      dateCondition += ' AND DATE(b.bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(b.bet_at) <= ?'
      params.push(dateTo)
    }
    
    const query = `
      SELECT 
        a.username as '代理账号',
        CASE a.agent_level WHEN 1 THEN '股东' WHEN 2 THEN '总代' WHEN 3 THEN '代理' ELSE '其他' END as '代理层级',
        pa.username as '上级代理',
        a.commission_rate as '佣金比例(%)',
        COUNT(DISTINCT p.id) as '直属会员数',
        COUNT(b.id) as '投注笔数',
        COALESCE(SUM(b.bet_amount), 0) as '总投注额',
        COALESCE(SUM(b.valid_bet), 0) as '有效投注',
        COALESCE(SUM(CASE WHEN b.profit_loss < 0 THEN ABS(b.profit_loss) ELSE -b.profit_loss END), 0) as '公司盈利',
        COALESCE(SUM(b.valid_bet) * a.commission_rate / 100, 0) as '预计佣金',
        a.balance as '代理余额',
        a.created_at as '创建时间'
      FROM agents a
      LEFT JOIN agents pa ON a.parent_id = pa.id
      LEFT JOIN players p ON p.agent_id = a.id
      LEFT JOIN bets b ON b.player_id = p.id ${dateCondition}
      GROUP BY a.id
      ORDER BY SUM(b.bet_amount) DESC
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 转账记录管理 API
// ============================================

// 获取转账记录列表
app.get('/api/transfers', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  const fromUsername = validateStringLength(c.req.query('from_username'), 50)
  const toUsername = validateStringLength(c.req.query('to_username'), 50)
  const status = validateStatus(c.req.query('status'))
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (startDate) {
      conditions += ' AND DATE(t.created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      conditions += ' AND DATE(t.created_at) <= ?'
      params.push(endDate)
    }
    if (fromUsername) {
      conditions += ' AND fp.username LIKE ?'
      params.push(`%${fromUsername}%`)
    }
    if (toUsername) {
      conditions += ' AND tp.username LIKE ?'
      params.push(`%${toUsername}%`)
    }
    if (status !== null) {
      conditions += ' AND t.status = ?'
      params.push(status)
    }
    
    const query = `
      SELECT t.*, 
        fp.username as from_username, 
        tp.username as to_username
      FROM player_transfers t
      LEFT JOIN players fp ON t.from_player_id = fp.id
      LEFT JOIN players tp ON t.to_player_id = tp.id
      WHERE 1=1 ${conditions}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(fee), 0) as total_fee,
        COALESCE(SUM(actual_amount), 0) as total_actual
      FROM player_transfers t
      LEFT JOIN players fp ON t.from_player_id = fp.id
      LEFT JOIN players tp ON t.to_player_id = tp.id
      WHERE 1=1 ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 转账手续费设置 API (必须在 :id 路由之前)
// ============================================

// 获取手续费配置列表
app.get('/api/transfers/fee-settings', async (c) => {
  const { DB } = c.env
  
  try {
    const result = await DB.prepare(`
      SELECT * FROM transfer_fee_settings
      ORDER BY priority DESC, id ASC
    `).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 新增手续费配置
app.post('/api/transfers/fee-settings', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { name, min_amount, max_amount, fee_type, fee_value, min_fee, max_fee, priority, description } = body
  
  if (!name || fee_value === undefined) {
    return c.json({ success: false, error: '名称和费率值为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO transfer_fee_settings (name, min_amount, max_amount, fee_type, fee_value, min_fee, max_fee, priority, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name,
      min_amount || 0,
      max_amount || null,
      fee_type || 'fixed',
      fee_value,
      min_fee || null,
      max_fee || null,
      priority || 100,
      description || ''
    ).run()
    
    return c.json({
      success: true,
      id: result.meta.last_row_id,
      message: '手续费配置添加成功'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新手续费配置
app.put('/api/transfers/fee-settings/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    const fieldMap: Record<string, string> = {
      name: 'name',
      min_amount: 'min_amount',
      max_amount: 'max_amount',
      fee_type: 'fee_type',
      fee_value: 'fee_value',
      min_fee: 'min_fee',
      max_fee: 'max_fee',
      is_enabled: 'is_enabled',
      priority: 'priority',
      description: 'description'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE transfer_fee_settings
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run()
    
    return c.json({
      success: true,
      message: '手续费配置更新成功'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除手续费配置
app.delete('/api/transfers/fee-settings/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('DELETE FROM transfer_fee_settings WHERE id = ?').bind(id).run()
    
    return c.json({
      success: true,
      message: '手续费配置删除成功'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 切换手续费配置状态
app.post('/api/transfers/fee-settings/:id/toggle', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  const { is_enabled } = body
  
  try {
    await DB.prepare(`
      UPDATE transfer_fee_settings
      SET is_enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(is_enabled ? 1 : 0, id).run()
    
    return c.json({
      success: true,
      message: is_enabled ? '配置已启用' : '配置已禁用'
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 计算转账手续费
app.get('/api/transfers/calculate-fee', async (c) => {
  const { DB } = c.env
  const amount = parseFloat(c.req.query('amount') || '0')
  
  if (amount <= 0) {
    return c.json({ success: false, error: '请输入有效的转账金额' }, 400)
  }
  
  try {
    // 获取匹配的手续费规则
    const rule = await DB.prepare(`
      SELECT * FROM transfer_fee_settings
      WHERE is_enabled = 1
        AND min_amount <= ?
        AND (max_amount IS NULL OR max_amount >= ?)
      ORDER BY priority DESC
      LIMIT 1
    `).bind(amount, amount).first()
    
    let fee = 0
    if (rule) {
      if ((rule as any).fee_type === 'fixed') {
        fee = (rule as any).fee_value
      } else {
        fee = amount * (rule as any).fee_value
      }
      
      // 应用最低/最高限制
      if ((rule as any).min_fee && fee < (rule as any).min_fee) {
        fee = (rule as any).min_fee
      }
      if ((rule as any).max_fee && fee > (rule as any).max_fee) {
        fee = (rule as any).max_fee
      }
    }
    
    return c.json({
      success: true,
      data: {
        amount,
        fee: Math.round(fee * 100) / 100,
        actual_amount: Math.round((amount - fee) * 100) / 100,
        rule_name: rule ? (rule as any).name : null,
        rule_id: rule ? (rule as any).id : null,
        fee_type: rule ? (rule as any).fee_type : null,
        fee_value: rule ? (rule as any).fee_value : null
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取转账详情 (包括IP地址和资金来源) - 必须在所有 /api/transfers/xxx 路由之后
app.get('/api/transfers/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    // 获取转账记录基本信息
    const transfer = await DB.prepare(`
      SELECT t.*, 
        fp.username as from_username, fp.nickname as from_nickname,
        tp.username as to_username, tp.nickname as to_nickname
      FROM player_transfers t
      LEFT JOIN players fp ON t.from_player_id = fp.id
      LEFT JOIN players tp ON t.to_player_id = tp.id
      WHERE t.id = ?
    `).bind(id).first()
    
    if (!transfer) {
      return c.json({ success: false, error: '转账记录不存在' }, 404)
    }
    
    // 获取转出人资金来源 (最近30条交易)
    const senderTransactions = await DB.prepare(`
      SELECT 
        transaction_type,
        amount,
        balance_before,
        balance_after,
        remark,
        created_at
      FROM transactions
      WHERE player_id = ?
      ORDER BY created_at DESC
      LIMIT 30
    `).bind((transfer as any).from_player_id).all()
    
    // 统计资金来源
    const fundSourceStats = await DB.prepare(`
      SELECT 
        transaction_type,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expense,
        COUNT(*) as count
      FROM transactions
      WHERE player_id = ?
      GROUP BY transaction_type
    `).bind((transfer as any).from_player_id).all()
    
    return c.json({
      success: true,
      data: {
        ...transfer,
        sender_ip: (transfer as any).ip_address,
        receiver_ip: (transfer as any).to_ip_address,
        sender_transactions: senderTransactions.results,
        sender_fund_sources: fundSourceStats.results
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 导出 API
// ============================================

// 日报表导出
app.get('/api/exports/daily', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  
  try {
    const params: any[] = []
    let dateCondition = "DATE(bet_at) >= DATE('now', '-30 days')"
    
    if (dateFrom) {
      dateCondition = 'DATE(bet_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      dateCondition += ' AND DATE(bet_at) <= ?'
      params.push(dateTo)
    }
    
    // 每日数据汇总
    const dailyData = await DB.prepare(`
      SELECT 
        DATE(bet_at) as '日期',
        COUNT(*) as '投注笔数',
        COUNT(DISTINCT player_id) as '投注人数',
        SUM(bet_amount) as '总投注额',
        SUM(valid_bet) as '有效投注',
        SUM(payout_amount) as '总派彩',
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as '会员亏损',
        SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as '会员盈利',
        SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE -profit_loss END) as '公司盈利'
      FROM bets
      WHERE ${dateCondition}
      GROUP BY DATE(bet_at)
      ORDER BY DATE(bet_at) DESC
    `).bind(...params).all()
    
    // 存款提款汇总
    const financeData = await DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as deposit,
        COUNT(CASE WHEN transaction_type = 'deposit' THEN 1 END) as deposit_count,
        SUM(CASE WHEN transaction_type = 'withdraw' THEN amount ELSE 0 END) as withdrawal,
        COUNT(CASE WHEN transaction_type = 'withdraw' THEN 1 END) as withdrawal_count
      FROM transactions
      WHERE ${dateCondition.replace('bet_at', 'created_at')}
      GROUP BY DATE(created_at)
    `).bind(...params).all()
    
    // 合并数据
    const financeMap = new Map()
    financeData.results.forEach((f: any) => {
      financeMap.set(f.date, f)
    })
    
    const mergedData = dailyData.results.map((d: any) => {
      const finance = financeMap.get(d['日期']) || {}
      return {
        ...d,
        '充值金额': finance.deposit || 0,
        '充值笔数': finance.deposit_count || 0,
        '提款金额': finance.withdrawal || 0,
        '提款笔数': finance.withdrawal_count || 0
      }
    })
    
    return c.json({
      success: true,
      data: mergedData,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 佣金报表导出
app.get('/api/exports/commission', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const status = c.req.query('status')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (dateFrom) {
      conditions += ' AND DATE(c.period_start) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions += ' AND DATE(c.period_end) <= ?'
      params.push(dateTo)
    }
    if (status !== undefined && status !== '') {
      conditions += ' AND c.status = ?'
      params.push(status)
    }
    
    const query = `
      SELECT 
        p.username as '会员账号',
        a.username as '代理账号',
        s.scheme_name as '洗码方案',
        c.period_start as '结算周期开始',
        c.period_end as '结算周期结束',
        c.valid_bet as '有效投注',
        c.commission_rate * 100 as '佣金比例(%)',
        c.commission_amount as '佣金金额',
        CASE c.status WHEN 0 THEN '待审核' WHEN 1 THEN '已结算' WHEN 2 THEN '已拒绝' ELSE '未知' END as '状态',
        c.created_at as '创建时间',
        c.settled_at as '结算时间'
      FROM commission_settlements c
      LEFT JOIN players p ON c.player_id = p.id
      LEFT JOIN commission_schemes s ON c.scheme_id = s.id
      LEFT JOIN agents a ON p.agent_id = a.id
      WHERE 1=1 ${conditions}
      ORDER BY c.created_at DESC
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 转账记录导出
app.get('/api/exports/transfers', async (c) => {
  const { DB } = c.env
  const dateFrom = c.req.query('date_from')
  const dateTo = c.req.query('date_to')
  const fromUsername = c.req.query('from_username')
  const toUsername = c.req.query('to_username')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (dateFrom) {
      conditions += ' AND DATE(t.created_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      conditions += ' AND DATE(t.created_at) <= ?'
      params.push(dateTo)
    }
    if (fromUsername) {
      conditions += ' AND fp.username LIKE ?'
      params.push(`%${fromUsername}%`)
    }
    if (toUsername) {
      conditions += ' AND tp.username LIKE ?'
      params.push(`%${toUsername}%`)
    }
    
    const query = `
      SELECT 
        t.transfer_no as '转账单号',
        fp.username as '转出账号',
        tp.username as '转入账号',
        t.amount as '转账金额',
        t.fee as '手续费',
        t.actual_amount as '实际到账',
        t.from_balance_before as '转出前余额',
        t.from_balance_after as '转出后余额',
        t.to_balance_before as '转入前余额',
        t.to_balance_after as '转入后余额',
        CASE t.status WHEN 0 THEN '处理中' WHEN 1 THEN '成功' WHEN 2 THEN '失败' ELSE '未知' END as '状态',
        t.ip_address as '转出人IP',
        t.to_ip_address as '转入人IP',
        t.remark as '备注',
        t.created_at as '创建时间'
      FROM player_transfers t
      LEFT JOIN players fp ON t.from_player_id = fp.id
      LEFT JOIN players tp ON t.to_player_id = tp.id
      WHERE 1=1 ${conditions}
      ORDER BY t.created_at DESC
      LIMIT 10000
    `
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 汇总
    const stats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        SUM(fee) as total_fee,
        SUM(actual_amount) as total_actual
      FROM player_transfers t
      LEFT JOIN players fp ON t.from_player_id = fp.id
      LEFT JOIN players tp ON t.to_player_id = tp.id
      WHERE 1=1 ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      exportTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 内容管理 API
// ============================================

// 公告列表
app.get('/api/announcements', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status')
  const type = c.req.query('type')
  
  try {
    let query = 'SELECT * FROM announcements WHERE 1=1'
    const params: any[] = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (type) {
      query += ' AND announcement_type = ?'
      params.push(type)
    }
    
    query += ' ORDER BY display_order DESC, created_at DESC LIMIT 50'
    
    const announcements = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: announcements.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建公告
app.post('/api/announcements', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { title, content, announcement_type, language, target_audience, image_url, link_url, display_order, publish_at, expire_at, status } = body
  
  if (!title || !content) {
    return c.json({ success: false, error: '标题和内容为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO announcements (title, content, announcement_type, language, target_audience, image_url, link_url, display_order, publish_at, expire_at, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(title, content, announcement_type || 'system', language || 'zh-CN', target_audience || 'all', image_url || '', link_url || '', display_order || 0, publish_at || null, expire_at || null, status || 0).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '公告创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新公告
app.put('/api/announcements/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    const fieldMap: Record<string, string> = {
      title: 'title',
      content: 'content',
      announcement_type: 'announcement_type',
      language: 'language',
      target_audience: 'target_audience',
      image_url: 'image_url',
      link_url: 'link_url',
      display_order: 'display_order',
      publish_at: 'publish_at',
      expire_at: 'expire_at',
      status: 'status'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE announcements SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '公告更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除公告
app.delete('/api/announcements/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '公告删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 系统设置 API
// ============================================

// 操作日志查询 (两个路由别名)
app.get('/api/logs/operations', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const module = c.req.query('module')
  const adminId = validateId(c.req.query('admin_id'))
  
  try {
    let query = `
      SELECT ol.*, a.username as admin_username
      FROM operation_logs ol
      LEFT JOIN admins a ON ol.admin_id = a.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (module) {
      query += ' AND ol.module = ?'
      params.push(module)
    }
    
    if (adminId !== null) {
      query += ' AND ol.admin_id = ?'
      params.push(adminId)
    }
    
    query += ' ORDER BY ol.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({
      success: true,
      data: result.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 操作日志查询别名 (前端使用)
app.get('/api/settings/logs', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const module = c.req.query('module')
  const adminId = validateId(c.req.query('admin_id'))
  
  try {
    let query = `
      SELECT ol.*, a.username as admin_username
      FROM operation_logs ol
      LEFT JOIN admins a ON ol.admin_id = a.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (module) {
      query += ' AND ol.module = ?'
      params.push(module)
    }
    
    if (adminId !== null) {
      query += ' AND ol.admin_id = ?'
      params.push(adminId)
    }
    
    query += ' ORDER BY ol.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    return c.json({ success: true, data: result.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 系统配置列表
app.get('/api/settings/configs', async (c) => {
  const { DB } = c.env
  
  try {
    const configs = await DB.prepare('SELECT * FROM system_configs ORDER BY config_key').all()
    
    return c.json({
      success: true,
      data: configs.results
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新系统配置
app.post('/api/settings/configs', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { config_key, config_value, config_type = 'string', description = '' } = body
  
  if (!config_key || config_value === undefined) {
    return c.json({ success: false, error: 'config_key和config_value为必填项' }, 400)
  }
  
  try {
    const existing = await DB.prepare('SELECT id FROM system_configs WHERE config_key = ?').bind(config_key).first()
    
    if (existing) {
      await DB.prepare(`
        UPDATE system_configs 
        SET config_value = ?, config_type = ?, description = ?, updated_by = 1, updated_at = datetime('now')
        WHERE config_key = ?
      `).bind(config_value || '', config_type || 'string', description || '', config_key).run()
    } else {
      await DB.prepare(`
        INSERT INTO system_configs (config_key, config_value, config_type, description, updated_by)
        VALUES (?, ?, ?, ?, 1)
      `).bind(config_key, config_value || '', config_type || 'string', description || '').run()
    }
    
    return c.json({ success: true, message: '配置更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 管理员账号管理 API
// ============================================

// 管理员列表
app.get('/api/admins', async (c) => {
  const { DB } = c.env
  try {
    const admins = await DB.prepare(`
      SELECT a.id, a.username, a.real_name as nickname, a.email, a.phone, a.status, 
             a.two_fa_enabled, a.last_login_at, a.created_at,
             GROUP_CONCAT(ar.role_name) as roles
      FROM admins a
      LEFT JOIN admin_role_bindings arb ON a.id = arb.admin_id
      LEFT JOIN admin_roles ar ON arb.role_id = ar.id
      GROUP BY a.id
      ORDER BY a.id DESC
    `).all()
    return c.json({ success: true, data: admins.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建管理员
app.post('/api/admins', async (c) => {
  const { DB } = c.env
  const { username, password, nickname, email, phone, role_ids } = await c.req.json()
  
  if (!username || !password) {
    return c.json({ success: false, error: '用户名和密码为必填项' }, 400)
  }
  
  try {
    const existing = await DB.prepare('SELECT id FROM admins WHERE username = ?').bind(username).first()
    if (existing) {
      return c.json({ success: false, error: '用户名已存在' }, 400)
    }
    
    const result = await DB.prepare(`
      INSERT INTO admins (username, password_hash, nickname, email, phone)
      VALUES (?, ?, ?, ?, ?)
    `).bind(username, password, nickname || '', email || '', phone || '').run()
    
    const adminId = result.meta.last_row_id
    
    if (role_ids && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await DB.prepare(`
          INSERT INTO admin_role_bindings (admin_id, role_id) VALUES (?, ?)
        `).bind(adminId, roleId).run()
      }
    }
    
    return c.json({ success: true, id: adminId, message: '管理员创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新管理员
app.put('/api/admins/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    // nickname映射到real_name (数据库字段是real_name)
    const fieldMap: Record<string, string> = {
      nickname: 'real_name',
      real_name: 'real_name',
      email: 'email',
      phone: 'phone',
      status: 'status'
    }
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (body[key] !== undefined) {
        updates.push(`${dbField} = ?`)
        values.push(body[key])
      }
    }
    
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')")
      values.push(id)
      
      await DB.prepare(`
        UPDATE admins SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run()
    }
    
    // 处理角色绑定
    if (body.role_ids !== undefined) {
      await DB.prepare('DELETE FROM admin_role_bindings WHERE admin_id = ?').bind(id).run()
      for (const roleId of body.role_ids) {
        await DB.prepare(`
          INSERT INTO admin_role_bindings (admin_id, role_id) VALUES (?, ?)
        `).bind(id, roleId).run()
      }
    }
    
    return c.json({ success: true, message: '管理员更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 角色权限管理 API
// ============================================

// 角色列表
app.get('/api/roles', async (c) => {
  const { DB } = c.env
  try {
    const roles = await DB.prepare(`
      SELECT r.*, COUNT(arb.admin_id) as admin_count
      FROM admin_roles r
      LEFT JOIN admin_role_bindings arb ON r.id = arb.role_id
      GROUP BY r.id
      ORDER BY r.id
    `).all()
    return c.json({ success: true, data: roles.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建角色
app.post('/api/roles', async (c) => {
  const { DB } = c.env
  const { role_name, role_display_name, permissions, description } = await c.req.json()
  
  if (!role_name || !role_display_name) {
    return c.json({ success: false, error: '角色名称为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO admin_roles (role_name, role_display_name, permissions, description)
      VALUES (?, ?, ?, ?)
    `).bind(role_name, role_display_name, JSON.stringify(permissions || []), description || '').run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '角色创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新角色
app.put('/api/roles/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: (string | number | null)[] = []
    
    if (body.role_display_name !== undefined) {
      updates.push('role_display_name = ?')
      values.push(body.role_display_name)
    }
    
    if (body.permissions !== undefined) {
      updates.push('permissions = ?')
      values.push(JSON.stringify(body.permissions))
    }
    
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    
    if (body.status !== undefined) {
      updates.push('status = ?')
      values.push(body.status)
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE admin_roles SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: '角色更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 权限定义 API
// ============================================

// 获取所有权限定义（用于角色权限分配）
app.get('/api/permissions', async (c) => {
  const { DB } = c.env
  try {
    const result = await DB.prepare(`
      SELECT * FROM permission_definitions
      ORDER BY sort_order, id
    `).all()
    
    // 将权限按分类组织
    const permissions = result.results
    const categories: Record<string, any> = {}
    
    for (const perm of permissions as any[]) {
      if (!categories[perm.category]) {
        categories[perm.category] = {
          category: perm.category,
          category_name: perm.category_name,
          permissions: []
        }
      }
      categories[perm.category].permissions.push(perm)
    }
    
    return c.json({ 
      success: true, 
      data: Object.values(categories),
      raw: result.results 
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取角色详情（包含权限）
app.get('/api/roles/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const role = await DB.prepare(`
      SELECT * FROM admin_roles WHERE id = ?
    `).bind(id).first()
    
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404)
    }
    
    // 解析权限JSON
    let permissions = []
    try {
      permissions = JSON.parse((role as any).permissions || '[]')
    } catch (e) {
      permissions = []
    }
    
    return c.json({ 
      success: true, 
      data: {
        ...role,
        permissions
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 管理员IP绑定 API（上级给下级设置）
// ============================================

// 获取管理员的IP绑定列表
app.get('/api/admins/:id/ip-bindings', async (c) => {
  const { DB } = c.env
  const adminId = c.req.param('id')
  
  try {
    const result = await DB.prepare(`
      SELECT aib.*, a.username as created_by_username
      FROM admin_ip_bindings aib
      LEFT JOIN admins a ON aib.created_by = a.id
      WHERE aib.admin_id = ?
      ORDER BY aib.created_at DESC
    `).bind(adminId).all()
    
    return c.json({ success: true, data: result.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 添加管理员IP绑定
app.post('/api/admins/:id/ip-bindings', async (c) => {
  const { DB } = c.env
  const adminId = validateId(c.req.param('id'))
  const { ip_address, description, created_by } = await c.req.json()
  
  if (adminId === null) {
    return c.json({ success: false, error: '无效的管理员ID' }, 400)
  }
  
  if (!ip_address) {
    return c.json({ success: false, error: 'IP地址为必填项' }, 400)
  }
  
  // IP地址格式验证（支持单IP和CIDR格式）
  const ipPattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/
  if (!ipPattern.test(ip_address)) {
    return c.json({ success: false, error: 'IP地址格式无效' }, 400)
  }
  
  // 限制描述长度
  const safeDescription = validateStringLength(description, 100)
  const createdById = validateId(created_by) || 1
  
  try {
    const result = await DB.prepare(`
      INSERT INTO admin_ip_bindings (admin_id, ip_address, description, created_by)
      VALUES (?, ?, ?, ?)
    `).bind(adminId, ip_address, safeDescription, createdById).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: 'IP绑定添加成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除管理员IP绑定
app.delete('/api/admins/:adminId/ip-bindings/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('DELETE FROM admin_ip_bindings WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'IP绑定删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 切换管理员IP绑定状态
app.post('/api/admins/:adminId/ip-bindings/:id/toggle', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { is_active } = await c.req.json()
  
  try {
    await DB.prepare(`
      UPDATE admin_ip_bindings SET is_active = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(is_active ? 1 : 0, id).run()
    
    return c.json({ success: true, message: is_active ? 'IP绑定已启用' : 'IP绑定已禁用' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// IP白名单管理 API
// ============================================

// IP白名单列表
app.get('/api/ip-whitelist', async (c) => {
  const { DB } = c.env
  try {
    const result = await DB.prepare(`
      SELECT iw.*, a.username as admin_username
      FROM ip_whitelist iw
      LEFT JOIN admins a ON iw.admin_id = a.id
      ORDER BY iw.id DESC
    `).all()
    return c.json({ success: true, data: result.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 添加IP白名单
app.post('/api/ip-whitelist', async (c) => {
  const { DB } = c.env
  const { ip_address, description, admin_id } = await c.req.json()
  
  if (!ip_address) {
    return c.json({ success: false, error: 'IP地址为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO ip_whitelist (ip_address, description, admin_id)
      VALUES (?, ?, ?)
    `).bind(ip_address, description || '', admin_id || null).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: 'IP添加成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新IP白名单
app.put('/api/ip-whitelist/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (body.ip_address !== undefined) {
      updates.push('ip_address = ?')
      values.push(body.ip_address)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.status !== undefined) {
      updates.push('status = ?')
      values.push(body.status)
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供要更新的字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`
      UPDATE ip_whitelist SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()
    
    return c.json({ success: true, message: 'IP更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除IP白名单
app.delete('/api/ip-whitelist/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('DELETE FROM ip_whitelist WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: 'IP删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 登录日志 API
// ============================================

// 管理员登录日志列表
app.get('/api/login-logs', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const adminId = validateId(c.req.query('admin_id'))
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  
  try {
    let conditions = ''
    const params: any[] = []
    
    if (adminId !== null) {
      conditions += ' AND admin_id = ?'
      params.push(adminId)
    }
    if (startDate) {
      conditions += ' AND DATE(created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      conditions += ' AND DATE(created_at) <= ?'
      params.push(endDate)
    }
    
    const queryParams = [...params, limit, (page - 1) * limit]
    const result = await DB.prepare(`
      SELECT * FROM admin_login_logs
      WHERE 1=1 ${conditions}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...queryParams).all()
    
    const countResult = await DB.prepare(`
      SELECT COUNT(*) as total FROM admin_login_logs WHERE 1=1 ${conditions}
    `).bind(...params).first()
    
    return c.json({
      success: true,
      data: result.results,
      total: (countResult as any)?.total || 0,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 2FA设置 API
// ============================================

// 获取2FA状态
app.get('/api/2fa/status/:adminId', async (c) => {
  const { DB } = c.env
  const adminId = c.req.param('adminId')
  
  try {
    const result = await DB.prepare(`
      SELECT is_enabled FROM admin_2fa_settings WHERE admin_id = ?
    `).bind(adminId).first()
    
    return c.json({
      success: true,
      data: {
        is_enabled: result ? (result as any).is_enabled === 1 : false
      }
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 启用/禁用2FA
app.post('/api/2fa/toggle', async (c) => {
  const { DB } = c.env
  const { admin_id, is_enabled, secret_key } = await c.req.json()
  
  if (!admin_id) {
    return c.json({ success: false, error: '管理员ID为必填项' }, 400)
  }
  
  try {
    // 检查是否已存在
    const existing = await DB.prepare(
      'SELECT id FROM admin_2fa_settings WHERE admin_id = ?'
    ).bind(admin_id).first()
    
    if (existing) {
      await DB.prepare(`
        UPDATE admin_2fa_settings 
        SET is_enabled = ?, secret_key = ?, updated_at = datetime('now')
        WHERE admin_id = ?
      `).bind(is_enabled ? 1 : 0, secret_key || null, admin_id).run()
    } else {
      await DB.prepare(`
        INSERT INTO admin_2fa_settings (admin_id, is_enabled, secret_key)
        VALUES (?, ?, ?)
      `).bind(admin_id, is_enabled ? 1 : 0, secret_key || null).run()
    }
    
    // 更新admins表的two_fa_enabled字段
    await DB.prepare(`
      UPDATE admins SET two_fa_enabled = ? WHERE id = ?
    `).bind(is_enabled ? 1 : 0, admin_id).run()
    
    return c.json({ success: true, message: is_enabled ? '2FA已启用' : '2FA已禁用' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 风控规则管理 API
// ============================================

// 风控规则列表
app.get('/api/risk/rules', async (c) => {
  const { DB } = c.env
  try {
    const rules = await DB.prepare('SELECT * FROM risk_rules ORDER BY id DESC').all()
    return c.json({ success: true, data: rules.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建风控规则
app.post('/api/risk/rules', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { rule_name, rule_type, rule_condition, severity, action, description, is_enabled } = body
  
  if (!rule_name || !rule_type) {
    return c.json({ success: false, error: '规则名称和类型为必填项' }, 400)
  }
  
  try {
    // rule_condition可能是字符串或对象
    const conditionStr = typeof rule_condition === 'string' ? rule_condition : JSON.stringify(rule_condition || {})
    
    const result = await DB.prepare(`
      INSERT INTO risk_rules (rule_name, rule_type, rule_condition, severity, action, description, is_enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      rule_name, 
      rule_type, 
      conditionStr, 
      severity || 'medium', 
      action || 'alert', 
      description || '',
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1
    ).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '风控规则创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新风控规则
app.put('/api/risk/rules/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (body.rule_name !== undefined) {
      updates.push('rule_name = ?')
      values.push(body.rule_name)
    }
    if (body.rule_type !== undefined) {
      updates.push('rule_type = ?')
      values.push(body.rule_type)
    }
    if (body.rule_condition !== undefined) {
      updates.push('rule_condition = ?')
      // rule_condition已经是字符串格式的JSON
      values.push(typeof body.rule_condition === 'string' ? body.rule_condition : JSON.stringify(body.rule_condition))
    }
    if (body.severity !== undefined) {
      updates.push('severity = ?')
      values.push(body.severity)
    }
    if (body.action !== undefined) {
      updates.push('action = ?')
      values.push(body.action)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.is_enabled !== undefined) {
      updates.push('is_enabled = ?')
      values.push(body.is_enabled ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供更新字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`UPDATE risk_rules SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    
    return c.json({ success: true, message: '风控规则更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// IP关联分析 API
// ============================================

app.get('/api/risk/ip-analysis', async (c) => {
  const { DB } = c.env
  const { min_players } = c.req.query()
  
  try {
    const minCount = parseInt(min_players || '2')
    const analysis = await DB.prepare(`
      SELECT * FROM ip_analysis 
      WHERE player_count >= ?
      ORDER BY player_count DESC, risk_score DESC
      LIMIT 100
    `).bind(minCount).all()
    
    return c.json({ success: true, data: analysis.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 台面风控监控 API (监控庄闲投注比例)
// ============================================

app.get('/api/risk/table-monitor', async (c) => {
  const { DB } = c.env
  const tableId = c.req.query('table_id')
  
  try {
    // 获取所有活跃桌台的实时投注情况
    let query = `
      SELECT 
        gt.id as table_id,
        gt.table_code,
        gt.table_name,
        gt.game_type,
        gt.status,
        d.stage_name as dealer_name,
        COUNT(DISTINCT pos.player_id) as online_players,
        COALESCE(SUM(CASE WHEN b.bet_type = 'banker' THEN b.bet_amount ELSE 0 END), 0) as banker_bet,
        COALESCE(SUM(CASE WHEN b.bet_type = 'player' THEN b.bet_amount ELSE 0 END), 0) as player_bet,
        COALESCE(SUM(CASE WHEN b.bet_type = 'tie' THEN b.bet_amount ELSE 0 END), 0) as tie_bet,
        COALESCE(SUM(b.bet_amount), 0) as total_bet,
        COUNT(b.id) as bet_count
      FROM game_tables gt
      LEFT JOIN dealers d ON gt.current_dealer_id = d.id
      LEFT JOIN player_online_status pos ON pos.current_table_id = gt.id AND pos.is_online = 1
      LEFT JOIN bets b ON b.table_id = gt.id AND b.status = 0 AND DATE(b.bet_at) = DATE('now')
      WHERE gt.status = 1
    `
    const params: any[] = []
    
    if (tableId) {
      query += ' AND gt.id = ?'
      params.push(tableId)
    }
    
    query += ' GROUP BY gt.id ORDER BY total_bet DESC'
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 计算风险等级
    const tablesWithRisk = result.results.map((table: any) => {
      const bankerBet = table.banker_bet || 0
      const playerBet = table.player_bet || 0
      const totalMainBet = bankerBet + playerBet
      
      let riskLevel = 'normal'
      let riskReason = ''
      let imbalanceRatio = 0
      
      if (totalMainBet > 0) {
        imbalanceRatio = Math.abs(bankerBet - playerBet) / totalMainBet * 100
        
        if (imbalanceRatio > 70) {
          riskLevel = 'high'
          riskReason = `庄闲比例严重失衡 (${imbalanceRatio.toFixed(1)}%)`
        } else if (imbalanceRatio > 50) {
          riskLevel = 'medium'
          riskReason = `庄闲比例失衡 (${imbalanceRatio.toFixed(1)}%)`
        }
      }
      
      // 大额投注预警
      if (table.total_bet > 100000) {
        if (riskLevel !== 'high') riskLevel = 'medium'
        riskReason += (riskReason ? '; ' : '') + '单桌投注额超过10万'
      }
      
      return {
        ...table,
        banker_ratio: totalMainBet > 0 ? (bankerBet / totalMainBet * 100).toFixed(1) : '0.0',
        player_ratio: totalMainBet > 0 ? (playerBet / totalMainBet * 100).toFixed(1) : '0.0',
        imbalance_ratio: imbalanceRatio.toFixed(1),
        risk_level: riskLevel,
        risk_reason: riskReason
      }
    })
    
    // 统计高风险桌台数
    const riskStats = {
      total: tablesWithRisk.length,
      high_risk: tablesWithRisk.filter((t: any) => t.risk_level === 'high').length,
      medium_risk: tablesWithRisk.filter((t: any) => t.risk_level === 'medium').length,
      total_bet: tablesWithRisk.reduce((sum: number, t: any) => sum + (t.total_bet || 0), 0),
      total_players: tablesWithRisk.reduce((sum: number, t: any) => sum + (t.online_players || 0), 0)
    }
    
    return c.json({
      success: true,
      data: tablesWithRisk,
      stats: riskStats
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 开奖结果查询 API
// ============================================

app.get('/api/game-results', async (c) => {
  const { DB } = c.env
  const { game_type, table_id, date } = c.req.query()
  
  try {
    let query = `
      SELECT gr.*, t.table_name, t.table_code
      FROM game_results gr
      LEFT JOIN game_tables t ON gr.table_id = t.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (game_type) {
      query += ' AND gr.game_type = ?'
      params.push(game_type)
    }
    if (table_id) {
      query += ' AND gr.table_id = ?'
      params.push(table_id)
    }
    if (date) {
      query += ' AND DATE(gr.created_at) = ?'
      params.push(date)
    }
    
    query += ' ORDER BY gr.created_at DESC LIMIT 100'
    
    const results = await DB.prepare(query).bind(...params).all()
    return c.json({ success: true, data: results.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 存款审核 API
// ============================================

app.get('/api/deposits/pending', async (c) => {
  const { DB } = c.env
  
  try {
    const deposits = await DB.prepare(`
      SELECT d.*, p.username, p.vip_level
      FROM deposits d
      JOIN players p ON d.player_id = p.id
      WHERE d.status = 0
      ORDER BY d.created_at DESC
    `).all()
    
    return c.json({ success: true, data: deposits.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

app.post('/api/deposits/:id/review', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { action, remark } = await c.req.json()
  
  try {
    const deposit = await DB.prepare('SELECT * FROM deposits WHERE id = ?').bind(id).first()
    if (!deposit) {
      return c.json({ success: false, error: '存款记录不存在' }, 404)
    }
    
    if (action === 'approve') {
      await DB.prepare(`
        UPDATE deposits SET status = 1, reviewed_by = 1, reviewed_at = datetime('now'), remark = ?
        WHERE id = ?
      `).bind(remark || '', id).run()
      
      await DB.prepare(`
        UPDATE players SET balance = balance + ? WHERE id = ?
      `).bind(deposit.amount, deposit.player_id).run()
      
      await DB.prepare(`
        INSERT INTO transactions (player_id, transaction_type, amount, balance_before, balance_after, reference_id, remark)
        SELECT ?, 'deposit', ?, balance - ?, balance, ?, ?
        FROM players WHERE id = ?
      `).bind(deposit.player_id, deposit.amount, deposit.amount, id, '存款审核通过', deposit.player_id).run()
    } else {
      await DB.prepare(`
        UPDATE deposits SET status = 2, reviewed_by = 1, reviewed_at = datetime('now'), remark = ?
        WHERE id = ?
      `).bind(remark || '审核拒绝', id).run()
    }
    
    return c.json({ success: true, message: `存款已${action === 'approve' ? '批准' : '拒绝'}` })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 存款补单 API
// ============================================

app.get('/api/deposits/supplements', async (c) => {
  const { DB } = c.env
  
  try {
    const supplements = await DB.prepare(`
      SELECT ds.*, p.username
      FROM deposit_supplements ds
      JOIN players p ON ds.player_id = p.id
      ORDER BY ds.created_at DESC
      LIMIT 100
    `).all()
    
    return c.json({ success: true, data: supplements.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

app.post('/api/deposits/supplements', async (c) => {
  const { DB } = c.env
  const { player_id, amount, payment_method, payment_reference, supplement_reason, original_deposit_id } = await c.req.json()
  
  if (!player_id || !amount || !supplement_reason) {
    return c.json({ success: false, error: '玩家ID、金额和补单原因为必填项' }, 400)
  }
  
  try {
    const orderNo = 'SUP' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase()
    
    const result = await DB.prepare(`
      INSERT INTO deposit_supplements (player_id, order_no, amount, payment_method, payment_reference, supplement_reason, original_deposit_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(player_id, orderNo, amount, payment_method || 'manual', payment_reference || '', supplement_reason, original_deposit_id || null).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, order_no: orderNo, message: '补单创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 红利派发 API
// ============================================

// 红利记录列表
app.get('/api/bonus/records', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  const bonusType = c.req.query('bonus_type')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')
  
  // 红利类型白名单验证
  const ALLOWED_BONUS_TYPES = ['signup', 'deposit', 'birthday', 'vip', 'activity', 'manual']
  const validBonusType = bonusType && ALLOWED_BONUS_TYPES.includes(bonusType) ? bonusType : null
  
  try {
    // 使用参数化查询
    let query = `
      SELECT 
        b.id, b.player_id, p.username, 
        b.bonus_type, b.amount, b.turnover_multiple,
        b.required_turnover, b.completed_turnover, b.status,
        b.expire_at, b.remark, b.created_at
      FROM bonus_records b
      LEFT JOIN players p ON b.player_id = p.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (validBonusType) {
      query += ' AND b.bonus_type = ?'
      params.push(validBonusType)
    }
    if (startDate) {
      query += ' AND DATE(b.created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      query += ' AND DATE(b.created_at) <= ?'
      params.push(endDate)
    }
    
    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, (page - 1) * limit)
    
    const result = await DB.prepare(query).bind(...params).all()
    
    // 统计
    const stats = await DB.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending_count,
        COALESCE(SUM(CASE WHEN DATE(created_at) = DATE('now') THEN amount ELSE 0 END), 0) as today_amount
      FROM bonus_records
    `).first()
    
    return c.json({
      success: true,
      data: result.results,
      stats,
      page,
      limit
    })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 派发红利
app.post('/api/bonus/dispatch', async (c) => {
  const { DB } = c.env
  const { username, bonus_type, amount, turnover_multiple, expire_days, remark } = await c.req.json()
  
  if (!username || !amount) {
    return c.json({ success: false, error: '会员账号和金额为必填项' }, 400)
  }
  
  // 金额验证
  const bonusAmount = validateAmount(amount)
  if (bonusAmount === null || bonusAmount > 1000000) {
    return c.json({ success: false, error: '无效的红利金额(须大于0且不超过100万)' }, 400)
  }
  
  // 用户名长度限制
  const safeUsername = validateStringLength(username, 50)
  if (!safeUsername) {
    return c.json({ success: false, error: '无效的会员账号' }, 400)
  }
  
  // 红利类型验证
  const ALLOWED_BONUS_TYPES = ['signup', 'deposit', 'birthday', 'vip', 'activity', 'manual']
  const validBonusType = bonus_type && ALLOWED_BONUS_TYPES.includes(bonus_type) ? bonus_type : 'manual'
  
  // 流水倍数验证
  const multiple = Math.max(0, Math.min(100, parseFloat(turnover_multiple) || 1))
  
  // 有效天数验证
  const expireDaysNum = Math.max(1, Math.min(365, parseInt(expire_days) || 7))
  
  // 备注长度限制
  const safeRemark = validateStringLength(remark, 200)
  
  try {
    // 查找玩家
    const player = await DB.prepare('SELECT id, balance FROM players WHERE username = ?').bind(safeUsername).first()
    if (!player) {
      return c.json({ success: false, error: '会员账号不存在' }, 404)
    }
    
    const playerId = (player as any).id
    const currentBalance = (player as any).balance || 0
    const newBalance = currentBalance + bonusAmount
    const requiredTurnover = bonusAmount * multiple
    
    // 计算过期时间
    const expireAt = new Date()
    expireAt.setDate(expireAt.getDate() + expireDaysNum)
    
    // 插入红利记录
    await DB.prepare(`
      INSERT INTO bonus_records (player_id, bonus_type, amount, turnover_multiple, required_turnover, status, expire_at, remark)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(playerId, validBonusType, bonusAmount, multiple, requiredTurnover, expireAt.toISOString(), safeRemark).run()
    
    // 更新余额
    await DB.prepare('UPDATE players SET balance = ? WHERE id = ?').bind(newBalance, playerId).run()
    
    // 记录交易
    await DB.prepare(`
      INSERT INTO transactions (player_id, transaction_type, amount, balance_before, balance_after, remark)
      VALUES (?, 'bonus', ?, ?, ?, ?)
    `).bind(playerId, bonusAmount, currentBalance, newBalance, safeRemark || `${validBonusType}红利派发`).run()
    
    return c.json({ success: true, message: '红利派发成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 流水稽查 API
// ============================================

// 流水稽查记录列表
app.get('/api/turnover/audit', async (c) => {
  const { DB } = c.env
  const { page, limit } = validatePagination(c.req.query('page'), c.req.query('limit'))
  
  try {
    // 使用参数化查询
    const result = await DB.prepare(`
      SELECT ta.*, p.username
      FROM turnover_audits ta
      LEFT JOIN players p ON ta.player_id = p.id
      ORDER BY ta.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, (page - 1) * limit).all()
    
    return c.json({
      success: true,
      data: result.results,
      page,
      limit
    })
  } catch (error) {
    // 表可能不存在，返回空数据
    return c.json({
      success: true,
      data: [],
      page,
      limit
    })
  }
})

// ============================================
// 流水稽查配置 API
// ============================================

// 流水配置列表
app.get('/api/turnover/configs', async (c) => {
  const { DB } = c.env
  const configType = validateConfigType(c.req.query('type'))
  
  try {
    let query = 'SELECT * FROM turnover_configs'
    const params: any[] = []
    
    if (configType) {
      query += ' WHERE config_type = ?'
      params.push(configType)
    }
    query += ' ORDER BY is_default DESC, id'
    
    const result = params.length > 0 
      ? await DB.prepare(query).bind(...params).all()
      : await DB.prepare(query).all()
    return c.json({ success: true, data: result.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取单个流水配置
app.get('/api/turnover/configs/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const config = await DB.prepare('SELECT * FROM turnover_configs WHERE id = ?').bind(id).first()
    if (!config) {
      return c.json({ success: false, error: '配置不存在' }, 404)
    }
    
    // 解析JSON字段
    const data = config as any
    try { data.game_contribution = JSON.parse(data.game_contribution || '{}') } catch(e) {}
    try { data.excluded_games = JSON.parse(data.excluded_games || '[]') } catch(e) {}
    
    return c.json({ success: true, data })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建流水配置
app.post('/api/turnover/configs', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { config_name, config_type, turnover_multiple, valid_days, game_contribution, min_bet_amount, max_bet_amount, excluded_games, description, is_default } = body
  
  if (!config_name || !config_type) {
    return c.json({ success: false, error: '配置名称和类型为必填项' }, 400)
  }
  
  try {
    // 如果设为默认，先取消同类型的其他默认
    if (is_default) {
      await DB.prepare('UPDATE turnover_configs SET is_default = 0 WHERE config_type = ?').bind(config_type).run()
    }
    
    const result = await DB.prepare(`
      INSERT INTO turnover_configs (config_name, config_type, turnover_multiple, valid_days, game_contribution, min_bet_amount, max_bet_amount, excluded_games, description, is_default, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      config_name, 
      config_type, 
      turnover_multiple || 1, 
      valid_days || 30,
      JSON.stringify(game_contribution || {}),
      min_bet_amount || 0,
      max_bet_amount || null,
      JSON.stringify(excluded_games || []),
      description || '',
      is_default ? 1 : 0
    ).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '流水配置创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新流水配置
app.put('/api/turnover/configs/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (body.config_name !== undefined) { updates.push('config_name = ?'); values.push(body.config_name) }
    if (body.turnover_multiple !== undefined) { updates.push('turnover_multiple = ?'); values.push(body.turnover_multiple) }
    if (body.valid_days !== undefined) { updates.push('valid_days = ?'); values.push(body.valid_days) }
    if (body.game_contribution !== undefined) { updates.push('game_contribution = ?'); values.push(JSON.stringify(body.game_contribution)) }
    if (body.min_bet_amount !== undefined) { updates.push('min_bet_amount = ?'); values.push(body.min_bet_amount) }
    if (body.max_bet_amount !== undefined) { updates.push('max_bet_amount = ?'); values.push(body.max_bet_amount) }
    if (body.excluded_games !== undefined) { updates.push('excluded_games = ?'); values.push(JSON.stringify(body.excluded_games)) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }
    
    if (body.is_default !== undefined) {
      // 先取消同类型的其他默认
      const config = await DB.prepare('SELECT config_type FROM turnover_configs WHERE id = ?').bind(id).first() as any
      if (config && body.is_default) {
        await DB.prepare('UPDATE turnover_configs SET is_default = 0 WHERE config_type = ?').bind(config.config_type).run()
      }
      updates.push('is_default = ?')
      values.push(body.is_default ? 1 : 0)
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供更新字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`UPDATE turnover_configs SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    return c.json({ success: true, message: '流水配置更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除流水配置
app.delete('/api/turnover/configs/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    // 检查是否被红利活动引用
    const used = await DB.prepare('SELECT id FROM bonus_activities WHERE turnover_config_id = ?').bind(id).first()
    if (used) {
      return c.json({ success: false, error: '该配置正在被红利活动使用，无法删除' }, 400)
    }
    
    await DB.prepare('DELETE FROM turnover_configs WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '流水配置删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 保留旧API兼容
app.get('/api/turnover/rules', async (c) => {
  const { DB } = c.env
  
  try {
    const configs = await DB.prepare(`
      SELECT * FROM system_configs 
      WHERE config_key LIKE 'turnover.%'
      ORDER BY config_key
    `).all()
    
    return c.json({ success: true, data: configs.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 红利活动方案 API
// ============================================

// 红利活动列表
app.get('/api/bonus/activities', async (c) => {
  const { DB } = c.env
  const status = validateStatus(c.req.query('status'))
  const activityType = validateActivityType(c.req.query('type'))
  
  try {
    let query = `
      SELECT ba.*, tc.config_name as turnover_config_name
      FROM bonus_activities ba
      LEFT JOIN turnover_configs tc ON ba.turnover_config_id = tc.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status !== null) {
      query += ' AND ba.status = ?'
      params.push(status)
    }
    if (activityType) {
      query += ' AND ba.activity_type = ?'
      params.push(activityType)
    }
    query += ' ORDER BY ba.priority, ba.id DESC'
    
    const result = params.length > 0
      ? await DB.prepare(query).bind(...params).all()
      : await DB.prepare(query).all()
    
    // 解析JSON字段
    const data = (result.results as any[]).map(item => {
      try { item.bonus_tiers = JSON.parse(item.bonus_tiers || '[]') } catch(e) {}
      try { item.vip_levels = JSON.parse(item.vip_levels || '[]') } catch(e) {}
      try { item.player_tags = JSON.parse(item.player_tags || '[]') } catch(e) {}
      return item
    })
    
    return c.json({ success: true, data })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 获取单个红利活动
app.get('/api/bonus/activities/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const activity = await DB.prepare(`
      SELECT ba.*, tc.config_name as turnover_config_name
      FROM bonus_activities ba
      LEFT JOIN turnover_configs tc ON ba.turnover_config_id = tc.id
      WHERE ba.id = ?
    `).bind(id).first()
    
    if (!activity) {
      return c.json({ success: false, error: '活动不存在' }, 404)
    }
    
    // 解析JSON字段
    const data = activity as any
    try { data.bonus_tiers = JSON.parse(data.bonus_tiers || '[]') } catch(e) {}
    try { data.vip_levels = JSON.parse(data.vip_levels || '[]') } catch(e) {}
    try { data.player_tags = JSON.parse(data.player_tags || '[]') } catch(e) {}
    
    return c.json({ success: true, data })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 创建红利活动
app.post('/api/bonus/activities', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  if (!body.activity_name || !body.activity_type || !body.bonus_type) {
    return c.json({ success: false, error: '活动名称、类型和红利形式为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO bonus_activities (
        activity_name, activity_type, bonus_type, bonus_value, bonus_tiers,
        max_bonus, min_deposit, max_deposit, turnover_config_id, auto_dispatch,
        claim_limit, claim_interval, vip_levels, player_tags, start_time, end_time,
        priority, description, terms_conditions, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      body.activity_name,
      body.activity_type,
      body.bonus_type,
      body.bonus_value || null,
      JSON.stringify(body.bonus_tiers || []),
      body.max_bonus || null,
      body.min_deposit || null,
      body.max_deposit || null,
      body.turnover_config_id || null,
      body.auto_dispatch ? 1 : 0,
      body.claim_limit || 1,
      body.claim_interval || 'once',
      JSON.stringify(body.vip_levels || []),
      JSON.stringify(body.player_tags || []),
      body.start_time || null,
      body.end_time || null,
      body.priority || 100,
      body.description || '',
      body.terms_conditions || '',
      body.status !== undefined ? body.status : 1
    ).run()
    
    return c.json({ success: true, id: result.meta.last_row_id, message: '红利活动创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 更新红利活动
app.put('/api/bonus/activities/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  try {
    const updates: string[] = []
    const values: any[] = []
    
    if (body.activity_name !== undefined) { updates.push('activity_name = ?'); values.push(body.activity_name) }
    if (body.activity_type !== undefined) { updates.push('activity_type = ?'); values.push(body.activity_type) }
    if (body.bonus_type !== undefined) { updates.push('bonus_type = ?'); values.push(body.bonus_type) }
    if (body.bonus_value !== undefined) { updates.push('bonus_value = ?'); values.push(body.bonus_value) }
    if (body.bonus_tiers !== undefined) { updates.push('bonus_tiers = ?'); values.push(JSON.stringify(body.bonus_tiers)) }
    if (body.max_bonus !== undefined) { updates.push('max_bonus = ?'); values.push(body.max_bonus) }
    if (body.min_deposit !== undefined) { updates.push('min_deposit = ?'); values.push(body.min_deposit) }
    if (body.max_deposit !== undefined) { updates.push('max_deposit = ?'); values.push(body.max_deposit) }
    if (body.turnover_config_id !== undefined) { updates.push('turnover_config_id = ?'); values.push(body.turnover_config_id) }
    if (body.auto_dispatch !== undefined) { updates.push('auto_dispatch = ?'); values.push(body.auto_dispatch ? 1 : 0) }
    if (body.claim_limit !== undefined) { updates.push('claim_limit = ?'); values.push(body.claim_limit) }
    if (body.claim_interval !== undefined) { updates.push('claim_interval = ?'); values.push(body.claim_interval) }
    if (body.vip_levels !== undefined) { updates.push('vip_levels = ?'); values.push(JSON.stringify(body.vip_levels)) }
    if (body.player_tags !== undefined) { updates.push('player_tags = ?'); values.push(JSON.stringify(body.player_tags)) }
    if (body.start_time !== undefined) { updates.push('start_time = ?'); values.push(body.start_time) }
    if (body.end_time !== undefined) { updates.push('end_time = ?'); values.push(body.end_time) }
    if (body.priority !== undefined) { updates.push('priority = ?'); values.push(body.priority) }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description) }
    if (body.terms_conditions !== undefined) { updates.push('terms_conditions = ?'); values.push(body.terms_conditions) }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status) }
    
    if (updates.length === 0) {
      return c.json({ success: false, error: '没有提供更新字段' }, 400)
    }
    
    updates.push("updated_at = datetime('now')")
    values.push(id)
    
    await DB.prepare(`UPDATE bonus_activities SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
    return c.json({ success: true, message: '红利活动更新成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 删除红利活动
app.delete('/api/bonus/activities/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    await DB.prepare('DELETE FROM bonus_activities WHERE id = ?').bind(id).run()
    return c.json({ success: true, message: '红利活动删除成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// 切换红利活动状态
app.post('/api/bonus/activities/:id/toggle', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  try {
    await DB.prepare(`
      UPDATE bonus_activities SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(status, id).run()
    
    return c.json({ success: true, message: status === 1 ? '活动已启用' : '活动已禁用' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 登录日志 API
// ============================================

app.get('/api/logs/login', async (c) => {
  const { DB } = c.env
  const { user_type, limit } = c.req.query()
  
  try {
    const logs = await DB.prepare(`
      SELECT * FROM user_login_logs
      ${user_type ? 'WHERE user_type = ?' : ''}
      ORDER BY login_time DESC
      LIMIT ?
    `).bind(...(user_type ? [user_type, parseInt(limit || '100')] : [parseInt(limit || '100')])).all()
    
    return c.json({ success: true, data: logs.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 限红组管理 API
// ============================================

app.get('/api/limit-groups', async (c) => {
  const { DB } = c.env
  
  try {
    const groups = await DB.prepare(`
      SELECT lg.*, COUNT(lgc.id) as config_count
      FROM limit_groups lg
      LEFT JOIN limit_group_configs lgc ON lg.id = lgc.group_id
      GROUP BY lg.id
      ORDER BY lg.id
    `).all()
    
    return c.json({ success: true, data: groups.results })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

app.get('/api/limit-groups/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  try {
    const group = await DB.prepare('SELECT * FROM limit_groups WHERE id = ?').bind(id).first()
    if (!group) {
      return c.json({ success: false, error: '限红组不存在' }, 404)
    }
    
    const configs = await DB.prepare('SELECT * FROM limit_group_configs WHERE group_id = ?').bind(id).all()
    
    return c.json({ success: true, data: { ...group, configs: configs.results } })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

app.post('/api/limit-groups', async (c) => {
  const { DB } = c.env
  const { group_name, description, is_default, configs } = await c.req.json()
  
  if (!group_name) {
    return c.json({ success: false, error: '限红组名称为必填项' }, 400)
  }
  
  try {
    const result = await DB.prepare(`
      INSERT INTO limit_groups (group_name, description, is_default)
      VALUES (?, ?, ?)
    `).bind(group_name, description || '', is_default ? 1 : 0).run()
    
    const groupId = result.meta.last_row_id
    
    if (configs && configs.length > 0) {
      for (const config of configs) {
        await DB.prepare(`
          INSERT INTO limit_group_configs (group_id, game_type, bet_type, min_bet, max_bet, max_payout)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(groupId, config.game_type, config.bet_type || null, config.min_bet || 10, config.max_bet || 100000, config.max_payout || null).run()
      }
    }
    
    return c.json({ success: true, id: groupId, message: '限红组创建成功' })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 7天趋势数据 API (活跃玩家)
// ============================================

app.get('/api/dashboard/trends', async (c) => {
  const { DB } = c.env
  
  try {
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    const trends = []
    for (const date of dates) {
      const betData = await DB.prepare(`
        SELECT COUNT(DISTINCT player_id) as active_players,
               COUNT(*) as bet_count,
               COALESCE(SUM(bet_amount), 0) as bet_amount,
               COALESCE(SUM(profit_loss), 0) as platform_win
        FROM bets
        WHERE DATE(bet_at) = ?
      `).bind(date).first()
      
      const depositData = await DB.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM deposits WHERE DATE(created_at) = ? AND status = 1
      `).bind(date).first()
      
      const newPlayers = await DB.prepare(`
        SELECT COUNT(*) as count FROM players WHERE DATE(created_at) = ?
      `).bind(date).first()
      
      trends.push({
        date,
        active_players: betData?.active_players || 0,
        bet_count: betData?.bet_count || 0,
        bet_amount: betData?.bet_amount || 0,
        platform_win: -(betData?.platform_win || 0),
        deposit_amount: depositData?.total || 0,
        deposit_count: depositData?.count || 0,
        new_players: newPlayers?.count || 0
      })
    }
    
    return c.json({ success: true, data: trends })
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500)
  }
})

// ============================================
// 前端页面路由
// ============================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>真人荷官视讯后台管理系统 V2.1</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎰</text></svg>">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        <link href="/static/css/admin.css" rel="stylesheet">
        <style>
          /* 登录页样式 */
          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%);
            position: relative;
            overflow: hidden;
          }
          .login-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
            animation: pulse 15s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.3; }
          }
          .login-box {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            padding: 48px;
            width: 100%;
            max-width: 420px;
            position: relative;
            z-index: 10;
          }
          .login-logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
          }
          .login-input {
            width: 100%;
            padding: 14px 16px 14px 48px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 15px;
            transition: all 0.3s;
            background: #f8fafc;
          }
          .login-input:focus {
            outline: none;
            border-color: #6366f1;
            background: white;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
          }
          .login-input-icon {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
          }
          .login-btn {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
          }
          .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
          }
          .login-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }
          .user-dropdown {
            position: relative;
          }
          .user-dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            min-width: 200px;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.2s;
          }
          .user-dropdown:hover .user-dropdown-menu,
          .user-dropdown-menu:hover {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
          }
          .user-dropdown-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            color: #475569;
            transition: all 0.2s;
            cursor: pointer;
          }
          .user-dropdown-item:first-child { border-radius: 12px 12px 0 0; }
          .user-dropdown-item:last-child { border-radius: 0 0 12px 12px; }
          .user-dropdown-item:hover { background: #f1f5f9; color: #6366f1; }
          .user-dropdown-item.danger:hover { background: #fef2f2; color: #ef4444; }
          .user-dropdown-divider { height: 1px; background: #e2e8f0; margin: 4px 0; }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- 登录页面 -->
        <div id="login-page" class="login-container">
            <div class="login-box">
                <div class="login-logo">
                    <i class="fas fa-dice text-white text-4xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-center text-gray-800 mb-2">真人荷官视讯</h1>
                <p class="text-center text-gray-500 mb-8">后台管理系统 V2.1</p>
                
                <form id="loginForm" onsubmit="handleLogin(event)">
                    <div class="mb-4 relative">
                        <i class="fas fa-user login-input-icon"></i>
                        <input type="text" id="loginUsername" class="login-input" placeholder="请输入用户名" autocomplete="username">
                    </div>
                    <div class="mb-6 relative">
                        <i class="fas fa-lock login-input-icon"></i>
                        <input type="password" id="loginPassword" class="login-input" placeholder="请输入密码" autocomplete="current-password">
                    </div>
                    <div id="loginError" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm hidden">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span id="loginErrorText"></span>
                    </div>
                    <button type="submit" id="loginBtn" class="login-btn">
                        <i class="fas fa-sign-in-alt mr-2"></i>登 录
                    </button>
                </form>
                
                <div class="mt-6 pt-6 border-t border-gray-200">
                    <p class="text-center text-gray-400 text-sm">
                        <i class="fas fa-shield-alt mr-1"></i>
                        安全登录 · 数据加密传输
                    </p>
                </div>
                
                <div class="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p class="text-xs text-blue-600 text-center">
                        <i class="fas fa-info-circle mr-1"></i>
                        测试账号: admin / admin888
                    </p>
                </div>
            </div>
        </div>
        
        <!-- 主应用 (初始隐藏) -->
        <div id="app" class="min-h-screen hidden">
            <!-- 侧边栏 -->
            <aside id="sidebar" class="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
                <!-- Logo区域 -->
                <div class="sidebar-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <i class="fas fa-dice text-white text-lg"></i>
                        </div>
                        <div>
                            <h1 class="text-white font-bold text-lg">真人荷官视讯</h1>
                            <p class="text-slate-400 text-xs">后台管理系统 V2.1</p>
                        </div>
                    </div>
                </div>
                
                <!-- 导航菜单 -->
                <nav class="sidebar-nav">
                    <!-- 运营监控 -->
                    <div class="nav-section">
                        <div class="nav-section-title">运营监控</div>
                        <a href="#dashboard" class="nav-item active" data-module="dashboard">
                            <i class="fas fa-chart-line"></i>
                            <span>仪表盘</span>
                        </a>
                        <a href="#studio" class="nav-item" data-module="studio">
                            <i class="fas fa-video"></i>
                            <span>现场运营</span>
                            <span class="nav-badge nav-badge-new">NEW</span>
                        </a>
                    </div>
                    
                    <!-- 会员管理 -->
                    <div class="nav-section">
                        <div class="nav-section-title">会员管理</div>
                        <a href="#players" class="nav-item" data-module="players">
                            <i class="fas fa-users"></i>
                            <span>玩家控端</span>
                        </a>
                        <a href="#agents" class="nav-item" data-module="agents">
                            <i class="fas fa-sitemap"></i>
                            <span>层级控端</span>
                        </a>
                    </div>
                    
                    <!-- 财务中心 -->
                    <div class="nav-section">
                        <div class="nav-section-title">财务中心</div>
                        <a href="#finance" class="nav-item" data-module="finance">
                            <i class="fas fa-money-bill-wave"></i>
                            <span>财务控端</span>
                        </a>
                        <a href="#bets" class="nav-item" data-module="bets">
                            <i class="fas fa-list-alt"></i>
                            <span>注单控端</span>
                        </a>
                        <a href="#commission" class="nav-item" data-module="commission">
                            <i class="fas fa-gift"></i>
                            <span>红利与洗码</span>
                            <span class="nav-badge nav-badge-hot">HOT</span>
                        </a>
                    </div>
                    
                    <!-- 风控报表 -->
                    <div class="nav-section">
                        <div class="nav-section-title">风控报表</div>
                        <a href="#risk" class="nav-item" data-module="risk">
                            <i class="fas fa-shield-alt"></i>
                            <span>风险控端</span>
                        </a>
                        <a href="#reports" class="nav-item" data-module="reports">
                            <i class="fas fa-chart-bar"></i>
                            <span>报表中心</span>
                        </a>
                    </div>
                    
                    <!-- 系统设置 -->
                    <div class="nav-section">
                        <div class="nav-section-title">系统设置</div>
                        <a href="#content" class="nav-item" data-module="content">
                            <i class="fas fa-bullhorn"></i>
                            <span>内容管理</span>
                        </a>
                        <a href="#settings" class="nav-item" data-module="settings">
                            <i class="fas fa-cog"></i>
                            <span>系统设置</span>
                        </a>
                    </div>
                </nav>
                
                <!-- 底部版本信息 -->
                <div class="p-4 border-t border-slate-700">
                    <div class="text-center text-slate-500 text-xs">
                        <p>© 2024 Live Casino Admin</p>
                        <p class="mt-1">Version 2.1.0</p>
                    </div>
                </div>
            </aside>

            <!-- 主内容区 -->
            <main class="main-content">
                <!-- 顶部栏 -->
                <header class="header">
                    <div class="header-title">
                        <h2 id="page-title">仪表盘</h2>
                        <p id="page-subtitle">实时监控 · 数据驱动</p>
                    </div>
                    <div class="header-user">
                        <div class="hidden sm:flex items-center gap-4 mr-4">
                            <button class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="通知">
                                <i class="fas fa-bell text-lg"></i>
                            </button>
                            <button class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" onclick="toggleFullscreen()" title="全屏">
                                <i class="fas fa-expand text-lg"></i>
                            </button>
                        </div>
                        
                        <!-- 用户下拉菜单 -->
                        <div class="user-dropdown">
                            <div class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors">
                                <div class="header-user-info hidden sm:block text-right">
                                    <p class="name" id="currentUserName">Admin</p>
                                    <p class="ip" id="currentUserRole">超级管理员</p>
                                </div>
                                <div class="header-avatar" id="currentUserAvatar">A</div>
                                <i class="fas fa-chevron-down text-gray-400 text-xs hidden sm:block"></i>
                            </div>
                            
                            <!-- 下拉菜单 -->
                            <div class="user-dropdown-menu">
                                <div class="p-3 border-b border-gray-100">
                                    <p class="font-semibold text-gray-800" id="dropdownUserName">Admin</p>
                                    <p class="text-xs text-gray-500" id="dropdownUserRole">超级管理员</p>
                                </div>
                                <div class="user-dropdown-item" onclick="showUserProfile()">
                                    <i class="fas fa-user-circle text-gray-400"></i>
                                    <span>个人信息</span>
                                </div>
                                <div class="user-dropdown-item" onclick="showChangePasswordModal()">
                                    <i class="fas fa-key text-gray-400"></i>
                                    <span>修改密码</span>
                                </div>
                                <div class="user-dropdown-divider"></div>
                                <div class="user-dropdown-item" onclick="loadModule('settings')">
                                    <i class="fas fa-cog text-gray-400"></i>
                                    <span>系统设置</span>
                                </div>
                                <div class="user-dropdown-divider"></div>
                                <div class="user-dropdown-item danger" onclick="handleLogout()">
                                    <i class="fas fa-sign-out-alt"></i>
                                    <span>退出登录</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- 内容区域 -->
                <div id="content" class="content-area">
                    <!-- 动态加载内容 -->
                </div>
            </main>
        </div>

        <!-- 模态框容器 -->
        <div id="modal-container"></div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/js/admin.js"></script>
    </body>
    </html>
  `)
})

export default app
