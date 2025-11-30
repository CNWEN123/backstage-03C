/**
 * 真人荷官视讯后台管理系统 V2.1
 * 前端主控制文件 - 完整功能版
 */

// ============================================
// 全局状态与配置
// ============================================

const AppState = {
  currentModule: 'dashboard',
  currentPage: 1,
  pageSize: 20,
  chartInstances: {},
  refreshTimer: null,
  modalStack: [],
  // 登录状态
  isLoggedIn: false,
  currentUser: null
}

// ============================================
// 登录/认证相关功能
// ============================================

// 检查登录状态
function checkLoginStatus() {
  const userData = localStorage.getItem('adminUser')
  const loginTime = localStorage.getItem('adminLoginTime')
  
  if (userData && loginTime) {
    // 检查是否超过8小时
    const now = Date.now()
    const loginTimestamp = parseInt(loginTime)
    const maxSessionTime = 8 * 60 * 60 * 1000 // 8小时
    
    if (now - loginTimestamp < maxSessionTime) {
      AppState.currentUser = JSON.parse(userData)
      AppState.isLoggedIn = true
      return true
    } else {
      // 会话过期
      clearLoginData()
      return false
    }
  }
  return false
}

// 清除登录数据
function clearLoginData() {
  localStorage.removeItem('adminUser')
  localStorage.removeItem('adminLoginTime')
  AppState.currentUser = null
  AppState.isLoggedIn = false
}

// 显示登录页
function showLoginPage() {
  document.getElementById('login-page').classList.remove('hidden')
  document.getElementById('app').classList.add('hidden')
  document.getElementById('loginUsername').focus()
}

// 显示主应用
function showMainApp() {
  document.getElementById('login-page').classList.add('hidden')
  document.getElementById('app').classList.remove('hidden')
  
  // 更新用户信息显示
  updateUserDisplay()
  
  // 加载默认模块
  loadModule('dashboard')
}

// 更新用户显示
function updateUserDisplay() {
  const user = AppState.currentUser
  if (!user) return
  
  const displayName = user.realName || user.username
  const roleDisplay = getRoleDisplay(user.role)
  const avatar = displayName.charAt(0).toUpperCase()
  
  // 更新顶部栏
  const nameEl = document.getElementById('currentUserName')
  const roleEl = document.getElementById('currentUserRole')
  const avatarEl = document.getElementById('currentUserAvatar')
  const dropdownNameEl = document.getElementById('dropdownUserName')
  const dropdownRoleEl = document.getElementById('dropdownUserRole')
  
  if (nameEl) nameEl.textContent = displayName
  if (roleEl) roleEl.textContent = roleDisplay
  if (avatarEl) avatarEl.textContent = avatar
  if (dropdownNameEl) dropdownNameEl.textContent = displayName
  if (dropdownRoleEl) dropdownRoleEl.textContent = roleDisplay
}

// 获取角色显示名称
function getRoleDisplay(role) {
  const roleMap = {
    'super_admin': '超级管理员',
    'finance': '财务主管',
    'risk_officer': '风控专员',
    'operator': '运营专员',
    'customer_service': '客服专员'
  }
  return roleMap[role] || role || '管理员'
}

// 处理登录
async function handleLogin(e) {
  e.preventDefault()
  
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value
  const loginBtn = document.getElementById('loginBtn')
  const errorDiv = document.getElementById('loginError')
  const errorText = document.getElementById('loginErrorText')
  
  if (!username || !password) {
    errorDiv.classList.remove('hidden')
    errorText.textContent = '请输入用户名和密码'
    return
  }
  
  // 禁用按钮，显示加载状态
  loginBtn.disabled = true
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>登录中...'
  errorDiv.classList.add('hidden')
  
  try {
    const response = await axios.post('/api/auth/login', { username, password })
    
    if (response.data.success) {
      // 保存登录信息
      localStorage.setItem('adminUser', JSON.stringify(response.data.data))
      localStorage.setItem('adminLoginTime', Date.now().toString())
      
      AppState.currentUser = response.data.data
      AppState.isLoggedIn = true
      
      showNotification('登录成功，欢迎回来！', 'success')
      
      // 延迟显示主界面
      setTimeout(() => {
        showMainApp()
      }, 500)
    } else {
      throw new Error(response.data.error || '登录失败')
    }
  } catch (error) {
    errorDiv.classList.remove('hidden')
    errorText.textContent = error.response?.data?.error || error.message || '登录失败，请重试'
  } finally {
    loginBtn.disabled = false
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>登 录'
  }
}

// 处理登出
async function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return
  
  try {
    // 调用登出API
    if (AppState.currentUser) {
      await axios.post('/api/auth/logout', { 
        adminId: AppState.currentUser.id 
      }).catch(() => {}) // 忽略错误
    }
  } finally {
    clearLoginData()
    showNotification('已安全退出', 'info')
    showLoginPage()
    
    // 清空密码输入框
    document.getElementById('loginPassword').value = ''
  }
}

// 显示修改密码弹窗
function showChangePasswordModal() {
  const content = `
    <form onsubmit="submitChangePassword(event)">
      <div class="form-group">
        <label class="form-label">原密码 *</label>
        <input type="password" id="oldPassword" class="form-input" required placeholder="请输入原密码">
      </div>
      <div class="form-group">
        <label class="form-label">新密码 *</label>
        <input type="password" id="newPassword" class="form-input" required placeholder="请输入新密码 (至少6位)">
      </div>
      <div class="form-group">
        <label class="form-label">确认新密码 *</label>
        <input type="password" id="confirmPassword" class="form-input" required placeholder="请再次输入新密码">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">确认修改</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('修改密码', content, { width: '400px' })
}

// 提交修改密码
async function submitChangePassword(e) {
  e.preventDefault()
  
  const oldPassword = document.getElementById('oldPassword').value
  const newPassword = document.getElementById('newPassword').value
  const confirmPassword = document.getElementById('confirmPassword').value
  
  if (newPassword !== confirmPassword) {
    showNotification('两次输入的新密码不一致', 'danger')
    return
  }
  
  if (newPassword.length < 6) {
    showNotification('新密码长度至少6位', 'danger')
    return
  }
  
  try {
    await API.post('/auth/change-password', {
      adminId: AppState.currentUser.id,
      oldPassword,
      newPassword
    })
    showNotification('密码修改成功，请重新登录', 'success')
    closeAllModals()
    
    // 强制重新登录
    setTimeout(() => {
      clearLoginData()
      showLoginPage()
    }, 1500)
  } catch (error) {
    showNotification(error.response?.data?.error || '修改失败', 'danger')
  }
}

// 显示个人信息
function showUserProfile() {
  const user = AppState.currentUser
  if (!user) return
  
  const content = `
    <div class="space-y-4">
      <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
          ${(user.realName || user.username).charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 class="text-lg font-semibold">${escapeHtml(user.realName || user.username)}</h3>
          <p class="text-gray-500">${getRoleDisplay(user.role)}</p>
        </div>
      </div>
      
      <div class="grid grid-2 gap-4">
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="text-xs text-gray-400 mb-1">用户名</div>
          <div class="font-medium">${escapeHtml(user.username)}</div>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="text-xs text-gray-400 mb-1">用户ID</div>
          <div class="font-medium">${user.id}</div>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="text-xs text-gray-400 mb-1">上次登录</div>
          <div class="font-medium text-sm">${user.lastLoginAt || '-'}</div>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg">
          <div class="text-xs text-gray-400 mb-1">上次登录IP</div>
          <div class="font-medium font-mono text-sm">${user.lastLoginIp || '-'}</div>
        </div>
      </div>
      
      <div class="pt-4 border-t">
        <button onclick="showChangePasswordModal(); closeAllModals();" class="btn btn-primary btn-sm w-full">
          <i class="fas fa-key mr-2"></i>修改密码
        </button>
      </div>
    </div>
  `
  showModal('个人信息', content, { width: '400px' })
}

// 全屏切换
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const PageConfig = {
  dashboard: { title: '仪表盘', subtitle: '实时监控 · 数据驱动' },
  players: { title: '玩家控端', subtitle: '会员管理 · CRM · KYC · LTV' },
  agents: { title: '层级控端', subtitle: '代理体系 · 金字塔结构 · 占成配置' },
  finance: { title: '财务控端', subtitle: '提款审核 · 资金流水 · 人工调账' },
  bets: { title: '注单控端', subtitle: '实时监控 · 历史查询 · 视频回放' },
  commission: { title: '红利与洗码', subtitle: 'V2.1升级 · 多策略配置 · 自动化结算' },
  risk: { title: '风险控端', subtitle: '实时监控 · 大额预警 · 套利识别' },
  reports: { title: '报表中心', subtitle: '多维度数据 · 盈亏分析 · 经营决策' },
  studio: { title: '现场运营控端', subtitle: 'V2.1新增 · 荷官排班 · 桌台管理' },
  content: { title: '内容管理', subtitle: '公告 · 轮播图 · 游戏规则' },
  settings: { title: '系统设置', subtitle: 'RBAC权限 · 2FA认证 · 操作日志' }
}

// ============================================
// API 工具函数
// ============================================

const API = {
  baseURL: '/api',
  
  async request(endpoint, options = {}) {
    try {
      const response = await axios({
        url: `${this.baseURL}${endpoint}`,
        ...options
      })
      return response.data
    } catch (error) {
      console.error('API Error:', error)
      showNotification('请求失败: ' + (error.response?.data?.error || error.message), 'danger')
      throw error
    }
  },
  
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint
    return this.request(url, { method: 'GET' })
  },
  
  async post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', data })
  },
  
  async put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', data })
  },
  
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

// ============================================
// UI 工具函数
// ============================================

function showNotification(message, type = 'info') {
  const icons = {
    success: 'check-circle',
    danger: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  }
  
  const notification = document.createElement('div')
  notification.className = `notification ${type}`
  notification.innerHTML = `<i class="fas fa-${icons[type]} mr-2"></i>${message}`
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

function formatCurrency(amount) {
  return '¥' + parseFloat(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function formatShortDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getStatusBadge(status, type = 'player') {
  const badges = {
    player: {
      1: '<span class="badge badge-success"><i class="fas fa-check-circle mr-1"></i>正常</span>',
      2: '<span class="badge badge-danger"><i class="fas fa-ban mr-1"></i>冻结</span>',
      3: '<span class="badge badge-warning"><i class="fas fa-clock mr-1"></i>审核中</span>'
    },
    withdrawal: {
      0: '<span class="badge badge-warning"><i class="fas fa-clock mr-1"></i>待审核</span>',
      1: '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>已批准</span>',
      2: '<span class="badge badge-danger"><i class="fas fa-times mr-1"></i>已拒绝</span>',
      3: '<span class="badge badge-info"><i class="fas fa-spinner mr-1"></i>处理中</span>',
      4: '<span class="badge badge-success"><i class="fas fa-check-double mr-1"></i>已完成</span>'
    },
    bet: {
      0: '<span class="badge badge-info"><i class="fas fa-hourglass-half mr-1"></i>未结算</span>',
      1: '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>已结算</span>',
      2: '<span class="badge badge-danger"><i class="fas fa-trash mr-1"></i>已作废</span>',
      3: '<span class="badge badge-gray"><i class="fas fa-undo mr-1"></i>已退还</span>'
    },
    commission: {
      0: '<span class="badge badge-warning"><i class="fas fa-clock mr-1"></i>待审核</span>',
      1: '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>已发放</span>',
      2: '<span class="badge badge-danger"><i class="fas fa-times mr-1"></i>已拒绝</span>',
      3: '<span class="badge badge-info"><i class="fas fa-robot mr-1"></i>自动发放</span>'
    },
    dealer: {
      1: '<span class="badge badge-success">在职</span>',
      2: '<span class="badge badge-warning">休假</span>',
      3: '<span class="badge badge-gray">离职</span>'
    },
    table: {
      1: '<span class="badge badge-success">运行中</span>',
      0: '<span class="badge badge-gray">维护中</span>'
    },
    announcement: {
      0: '<span class="badge badge-gray">草稿</span>',
      1: '<span class="badge badge-success">已发布</span>',
      2: '<span class="badge badge-danger">已下架</span>'
    }
  }
  
  return badges[type]?.[status] || '<span class="badge badge-gray">未知</span>'
}

function getGameTypeName(type) {
  const names = {
    'baccarat': '百家乐',
    'dragon_tiger': '龙虎',
    'roulette': '轮盘',
    'sicbo': '骰宝',
    'bull_bull': '牛牛',
    'niuniu': '牛牛'
  }
  return names[type] || type || '未知'
}

function getTransactionTypeName(type) {
  const names = {
    'deposit': '存款',
    'withdraw': '提款',
    'bet': '投注',
    'payout': '派彩',
    'bonus': '红利',
    'commission': '洗码',
    'adjustment': '调账'
  }
  return names[type] || type
}

// XSS防护 - HTML转义
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function showLoading() {
  return `
    <div class="loading-container">
      <div class="loading-spinner"></div>
    </div>
  `
}

function showEmpty(icon = 'inbox', title = '暂无数据', text = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i class="fas fa-${icon}"></i>
      </div>
      <div class="empty-state-title">${title}</div>
      ${text ? `<div class="empty-state-text">${text}</div>` : ''}
    </div>
  `
}

// ============================================
// 模态框管理
// ============================================

function showModal(title, content, options = {}) {
  const { width = '600px', showClose = true, onClose } = options
  
  const modalId = 'modal-' + Date.now()
  const modalHtml = `
    <div id="${modalId}" class="modal-overlay" onclick="if(event.target === this) closeModal('${modalId}')">
      <div class="modal-container" style="max-width: ${width}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          ${showClose ? `<button class="modal-close" onclick="closeModal('${modalId}')">&times;</button>` : ''}
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    </div>
  `
  
  document.getElementById('modal-container').innerHTML += modalHtml
  AppState.modalStack.push({ id: modalId, onClose })
  
  return modalId
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) {
    modal.remove()
    const stackItem = AppState.modalStack.find(m => m.id === modalId)
    if (stackItem?.onClose) stackItem.onClose()
    AppState.modalStack = AppState.modalStack.filter(m => m.id !== modalId)
  }
}

function closeAllModals() {
  document.getElementById('modal-container').innerHTML = ''
  AppState.modalStack = []
}

// ============================================
// 模块加载器
// ============================================

const Modules = {
  // ==========================================
  // 仪表盘模块
  // ==========================================
  async dashboard() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    try {
      const data = await API.get('/dashboard/stats')
      const stats = data.data
      
      content.innerHTML = `
        <!-- 统计卡片 -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon blue">
                <i class="fas fa-wallet"></i>
              </div>
              <span class="stat-card-trend up">
                <i class="fas fa-arrow-up mr-1"></i>12.5%
              </span>
            </div>
            <div class="stat-card-value">${formatCurrency(stats.totalBalance)}</div>
            <div class="stat-card-label">平台总余额</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon ${stats.todayProfit >= 0 ? 'green' : 'red'}">
                <i class="fas fa-chart-line"></i>
              </div>
              <span class="stat-card-trend ${stats.todayProfit >= 0 ? 'up' : 'down'}">
                ${stats.todayProfit >= 0 ? '+' : ''}${formatCurrency(stats.todayProfit)}
              </span>
            </div>
            <div class="stat-card-value">${formatCurrency(Math.abs(stats.todayProfit))}</div>
            <div class="stat-card-label">今日${stats.todayProfit >= 0 ? '盈利' : '亏损'}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon purple">
                <i class="fas fa-dice"></i>
              </div>
              <span class="stat-card-trend neutral">
                ${stats.todayBetCount || 0} 笔
              </span>
            </div>
            <div class="stat-card-value">${formatCurrency(stats.todayBetting)}</div>
            <div class="stat-card-label">今日投注额</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon red">
                <i class="fas fa-money-bill-wave"></i>
              </div>
              <span class="stat-card-trend ${stats.pendingWithdrawals > 0 ? 'down' : 'neutral'}">
                待审 ${stats.pendingWithdrawals || 0}
              </span>
            </div>
            <div class="stat-card-value">${formatCurrency(stats.todayWithdrawal)}</div>
            <div class="stat-card-label">今日提款</div>
          </div>
        </div>
        
        <!-- 第二行统计 -->
        <div class="stats-grid mb-6">
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon green">
                <i class="fas fa-arrow-down"></i>
              </div>
            </div>
            <div class="stat-card-value">${formatCurrency(stats.todayDeposit)}</div>
            <div class="stat-card-label">今日存款 (${stats.todayDepositCount || 0}笔)</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon blue">
                <i class="fas fa-user-plus"></i>
              </div>
            </div>
            <div class="stat-card-value">${stats.newPlayersToday || 0}</div>
            <div class="stat-card-label">今日新增玩家</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon yellow">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
            </div>
            <div class="stat-card-value">${stats.pendingRiskAlerts || 0}</div>
            <div class="stat-card-label">待处理风险预警</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-card-header">
              <div class="stat-card-icon purple">
                <i class="fas fa-users"></i>
              </div>
            </div>
            <div class="stat-card-value">${stats.onlinePlayers || 0}</div>
            <div class="stat-card-label">在线玩家</div>
          </div>
        </div>
        
        <!-- 中间区域：实时在线 + 快捷操作 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <!-- 实时在线 -->
          <div class="card">
            <div class="card-body text-center">
              <div class="flex items-center justify-center gap-2 mb-4">
                <span class="live-indicator">
                  <span class="live-indicator-dot"></span>
                  实时更新
                </span>
              </div>
              <div class="text-6xl font-bold text-indigo-600 mb-2">${stats.onlinePlayers || 0}</div>
              <div class="text-gray-500">当前在线玩家</div>
              <div class="mt-6 pt-4 border-t text-sm text-gray-400">
                <i class="fas fa-clock mr-1"></i>
                活跃高峰期 20:00-23:00
              </div>
            </div>
          </div>
          
          <!-- 快捷操作 -->
          <div class="card lg:col-span-2">
            <div class="card-header">
              <div class="card-header-title">
                <h3>快捷操作</h3>
              </div>
            </div>
            <div class="card-body">
              <div class="quick-actions">
                <button onclick="showDepositModal()" class="quick-action-btn blue">
                  <i class="fas fa-plus-circle"></i>
                  <span>人工存款</span>
                </button>
                <button onclick="showWithdrawModal()" class="quick-action-btn red">
                  <i class="fas fa-minus-circle"></i>
                  <span>人工提款</span>
                </button>
                <button onclick="showAnnouncementModal()" class="quick-action-btn green">
                  <i class="fas fa-bullhorn"></i>
                  <span>发布公告</span>
                </button>
                <button onclick="loadModule('risk')" class="quick-action-btn yellow">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>风控预警 (${stats.pendingRiskAlerts || 0})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 趋势图表 -->
        <div class="card">
          <div class="card-body">
            <div class="chart-header">
              <div class="chart-title">投注趋势（近7天）</div>
              <div class="chart-actions">
                <button class="chart-action-btn active">近7天</button>
                <button class="chart-action-btn">近30天</button>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="trendChart"></canvas>
            </div>
          </div>
        </div>
      `
      
      renderTrendChart(stats.trendData || [])
      
    } catch (error) {
      content.innerHTML = `
        <div class="card">
          ${showEmpty('exclamation-circle', '加载失败', '请刷新页面重试')}
        </div>
      `
    }
  },
  
  // ==========================================
  // 玩家控端模块
  // ==========================================
  async players() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    try {
      const data = await API.get('/players')
      
      content.innerHTML = `
        <!-- 标签页 -->
        <div class="tabs-container mb-4">
          <div class="tabs">
            <button class="tab-btn active" onclick="switchPlayerTab('list')">
              <i class="fas fa-users mr-2"></i>玩家列表
            </button>
            <button class="tab-btn" onclick="switchPlayerTab('online')">
              <i class="fas fa-signal mr-2"></i>在线玩家
              <span id="onlinePlayerBadge" class="badge badge-success ml-2">0</span>
            </button>
          </div>
        </div>
        
        <div id="playerListTab" class="card">
          <!-- 筛选栏 -->
          <div class="filter-bar">
            <div class="filter-search">
              <i class="fas fa-search"></i>
              <input type="text" id="playerSearch" class="form-input" placeholder="搜索用户名/昵称/手机号...">
            </div>
            <select id="statusFilter" class="form-select filter-select">
              <option value="">全部状态</option>
              <option value="1">正常</option>
              <option value="2">冻结</option>
              <option value="3">审核中</option>
            </select>
            <select id="vipFilter" class="form-select filter-select">
              <option value="">全部VIP等级</option>
              <option value="0">VIP 0</option>
              <option value="1">VIP 1</option>
              <option value="2">VIP 2</option>
              <option value="3">VIP 3</option>
              <option value="4">VIP 4</option>
              <option value="5">VIP 5</option>
              <option value="6">VIP 6</option>
              <option value="7">VIP 7</option>
            </select>
            <div class="filter-actions">
              <button onclick="searchPlayers()" class="btn btn-primary btn-sm">
                <i class="fas fa-search"></i> 搜索
              </button>
              <button onclick="showAddPlayerModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus"></i> 新增玩家
              </button>
            </div>
          </div>
          
          <!-- 表格 -->
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>用户ID</th>
                  <th>账号</th>
                  <th>昵称</th>
                  <th class="text-right">余额</th>
                  <th class="text-center">VIP等级</th>
                  <th class="text-center">状态</th>
                  <th>注册时间</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                ${data.data.length === 0 ? `<tr><td colspan="8">${showEmpty('users', '暂无玩家数据')}</td></tr>` :
                  data.data.map(player => `
                  <tr>
                    <td class="font-mono text-gray-500">${player.id}</td>
                    <td class="font-semibold">${escapeHtml(player.username)}</td>
                    <td class="text-gray-600">${escapeHtml(player.nickname || '-')}</td>
                    <td class="text-right font-mono font-semibold text-emerald-600">${formatCurrency(player.balance)}</td>
                    <td class="text-center">
                      <span class="badge ${player.vip_level >= 5 ? 'badge-warning' : 'badge-info'}">
                        <i class="fas fa-crown mr-1"></i>VIP ${player.vip_level}
                      </span>
                    </td>
                    <td class="text-center">${getStatusBadge(player.status, 'player')}</td>
                    <td class="text-gray-500 text-sm">${formatShortDate(player.created_at)}</td>
                    <td class="text-center">
                      <div class="flex items-center justify-center gap-2">
                        <button onclick="viewPlayerDetail(${player.id})" class="btn btn-primary btn-xs">
                          详情
                        </button>
                        <button onclick="togglePlayerStatus(${player.id}, ${player.status})" class="btn ${player.status === 1 ? 'btn-danger' : 'btn-success'} btn-xs">
                          ${player.status === 1 ? '冻结' : '解冻'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- 分页 -->
          <div class="card-footer">
            <div class="text-sm text-gray-500">
              共 <span class="font-semibold text-gray-800">${data.total || data.data.length}</span> 条记录
            </div>
            <div class="pagination">
              <button class="pagination-btn" disabled>
                <i class="fas fa-chevron-left"></i>
              </button>
              <button class="pagination-btn active">1</button>
              <button class="pagination-btn" disabled>
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 在线玩家Tab (初始隐藏) -->
        <div id="onlinePlayerTab" class="hidden"></div>
      `
      
      // 获取在线玩家数量更新Badge
      loadOnlinePlayerCount()
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败')}</div>`
    }
  },
  
  // ==========================================
  // 层级控端模块
  // ==========================================
  async agents() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    try {
      const data = await API.get('/agents')
      
      const getLevelBadge = (level) => {
        const config = {
          1: { class: 'badge-danger', icon: 'crown', text: '股东' },
          2: { class: 'badge-warning', icon: 'star', text: '总代' },
          3: { class: 'badge-info', icon: 'user', text: '代理' }
        }
        const c = config[level] || config[3]
        return `<span class="badge ${c.class}"><i class="fas fa-${c.icon} mr-1"></i>${c.text}</span>`
      }
      
      content.innerHTML = `
        <div class="card">
          <!-- 头部 -->
          <div class="card-header">
            <div class="card-header-title">
              <h3>股东/代理管理</h3>
              <p>金字塔代理体系：股东 → 总代 → 代理 → 玩家</p>
            </div>
            <div class="card-header-actions">
              <button onclick="showAddAgentModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus"></i> 新增股东/代理
              </button>
            </div>
          </div>
          
          <!-- 表格 -->
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>代理账号</th>
                  <th class="text-center">层级</th>
                  <th>分享码</th>
                  <th>专属域名</th>
                  <th class="text-right">占成</th>
                  <th class="text-center">下级</th>
                  <th class="text-center">玩家</th>
                  <th class="text-center">状态</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                ${data.data.map(agent => `
                  <tr>
                    <td class="font-mono text-gray-500">${escapeHtml(String(agent.id))}</td>
                    <td class="font-semibold">${escapeHtml(agent.username)}</td>
                    <td class="text-center">${getLevelBadge(agent.agent_level)}</td>
                    <td>
                      ${agent.share_code ? 
                        `<span class="font-mono text-xs bg-slate-700 px-2 py-1 rounded cursor-pointer" onclick="showAgentShareLink(${agent.id})" title="点击查看分享链接">${agent.share_code}</span>` 
                        : '<span class="text-gray-400 text-xs">-</span>'}
                    </td>
                    <td>
                      ${agent.custom_domain ? 
                        `<span class="font-mono text-xs text-emerald-400" title="${escapeHtml(agent.custom_domain)}">${escapeHtml(agent.custom_domain.length > 20 ? agent.custom_domain.substring(0, 20) + '...' : agent.custom_domain)}</span>` 
                        : '<span class="text-gray-400 text-xs">未绑定</span>'}
                    </td>
                    <td class="text-right font-semibold text-blue-600">${agent.profit_share}%</td>
                    <td class="text-center">${agent.sub_agent_count || 0}</td>
                    <td class="text-center">${agent.player_count || 0}</td>
                    <td class="text-center">${getStatusBadge(agent.status, 'player')}</td>
                    <td class="text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button onclick="viewAgentDetail(${agent.id})" class="btn btn-primary btn-xs" title="详情"><i class="fas fa-eye"></i></button>
                        <button onclick="editAgent(${agent.id})" class="btn btn-secondary btn-xs" title="编辑"><i class="fas fa-edit"></i></button>
                        <button onclick="showAgentShareLink(${agent.id})" class="btn btn-info btn-xs" title="分享"><i class="fas fa-share-alt"></i></button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- 底部统计 -->
          <div class="card-footer">
            <span class="text-sm text-gray-500">
              共 <span class="font-semibold text-gray-800">${data.data.length}</span> 个代理
            </span>
            <span class="text-sm text-gray-500">
              层级结构：<span class="font-semibold text-gray-800">3</span> 级
            </span>
          </div>
        </div>
      `
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败')}</div>`
    }
  },
  
  // ==========================================
  // 财务控端模块
  // ==========================================
  async finance() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    try {
      const [pendingData, depositsData, paymentMethods] = await Promise.all([
        API.get('/withdrawals/pending'),
        API.get('/deposits', { limit: 10 }),
        API.get('/payment-methods', { include_stats: '1' })
      ])
      
      // 计算收款方式统计
      const enabledMethods = paymentMethods.typeStats?.enabled || 0
      
      content.innerHTML = `
        <div class="card mb-6">
          <!-- 头部 -->
          <div class="card-header">
            <div class="card-header-title">
              <h3>财务控端</h3>
              <p>提款审核 · 资金流水 · 收款方式</p>
            </div>
            <div class="card-header-actions">
              <button onclick="showDepositModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus-circle"></i> 人工存款
              </button>
              <button onclick="showWithdrawModal()" class="btn btn-primary btn-sm">
                <i class="fas fa-minus-circle"></i> 人工提款
              </button>
              <button onclick="showAdjustmentModal()" class="btn btn-secondary btn-sm">
                <i class="fas fa-balance-scale"></i> 人工调账
              </button>
            </div>
          </div>
          
          <!-- 标签页 -->
          <div class="tabs">
            <div class="tab active" onclick="switchFinanceTab('pending')">
              提款审核
              ${pendingData.data.length > 0 ? `<span class="tab-badge">${pendingData.data.length}</span>` : ''}
            </div>
            <div class="tab" onclick="switchFinanceTab('deposits')">存款记录</div>
            <div class="tab" onclick="switchFinanceTab('withdrawals')">提款记录</div>
            <div class="tab" onclick="switchFinanceTab('transactions')">资金流水</div>
            <div class="tab" onclick="switchFinanceTab('payment-methods')">
              <i class="fas fa-credit-card mr-1"></i>收款方式
              <span class="badge badge-info ml-1">${enabledMethods}</span>
            </div>
          </div>
          
          <!-- 提款列表 -->
          <div id="finance-content" class="card-body">
            ${pendingData.data.length === 0 ? showEmpty('check-circle', '暂无待审核提款', '所有提款申请已处理完成') : `
              <div class="space-y-md">
                ${pendingData.data.map(w => `
                  <div class="info-card ${w.amount >= 20000 ? 'border-l-4 border-l-amber-500' : ''}">
                    <div class="flex flex-col lg:flex-row lg:items-center gap-4">
                      <!-- 左侧信息 -->
                      <div class="flex-1">
                        <div class="flex items-center flex-wrap gap-3 mb-3">
                          <span class="text-lg font-semibold">${w.username}</span>
                          <span class="text-sm text-gray-400 font-mono">${w.order_no}</span>
                          ${w.turnover_check === 1 ? 
                            '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>流水达标</span>' : 
                            `<span class="badge badge-danger"><i class="fas fa-times mr-1"></i>流水 ${((w.actual_turnover / w.required_turnover * 100) || 0).toFixed(0)}%</span>`
                          }
                        </div>
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div class="text-gray-400 mb-1">提款金额</div>
                            <div class="text-xl font-semibold text-red-600">${formatCurrency(w.amount)}</div>
                          </div>
                          <div>
                            <div class="text-gray-400 mb-1">银行</div>
                            <div class="font-medium">${w.bank_name || '-'}</div>
                          </div>
                          <div>
                            <div class="text-gray-400 mb-1">账号</div>
                            <div class="font-mono">${w.bank_account || '-'}</div>
                          </div>
                          <div>
                            <div class="text-gray-400 mb-1">申请时间</div>
                            <div>${formatShortDate(w.created_at)}</div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 右侧操作 -->
                      <div class="flex items-center gap-2">
                        <button onclick="reviewWithdrawal(${w.id}, 'approve')" class="btn btn-success btn-sm">
                          <i class="fas fa-check"></i> 通过
                        </button>
                        <button onclick="reviewWithdrawal(${w.id}, 'reject')" class="btn btn-danger btn-sm">
                          <i class="fas fa-times"></i> 拒绝
                        </button>
                      </div>
                    </div>
                    
                    ${w.amount >= 20000 ? `
                      <div class="alert-card warning mt-4">
                        <i class="fas fa-exclamation-triangle alert-card-icon"></i>
                        <div class="alert-card-content">
                          <div class="alert-card-text">大额出款预警：单笔超过 ¥20,000 阈值，需财务经理二次复核</div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败')}</div>`
    }
  },
  
  // ==========================================
  // 注单控端模块
  // ==========================================
  async bets() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    // 默认日期范围：最近7天
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    try {
      const data = await API.get('/bets', { limit: 100 })
      
      content.innerHTML = `
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-header-title">
              <h3><i class="fas fa-list-alt mr-2"></i>注单管理</h3>
              <p>多维度查询 · 数据统计 · 报表导出</p>
            </div>
          </div>
          
          <!-- 高级筛选栏 -->
          <div class="p-4 bg-gray-50 border-b">
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">注单号</label>
                <input type="text" id="betNoSearch" class="form-input form-input-sm" placeholder="输入注单号">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">会员账号</label>
                <input type="text" id="betUsernameSearch" class="form-input form-input-sm" placeholder="输入会员账号">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">游戏类型</label>
                <select id="gameTypeFilter" class="form-select form-input-sm">
                  <option value="">全部游戏</option>
                  <option value="baccarat">百家乐</option>
                  <option value="dragon_tiger">龙虎</option>
                  <option value="roulette">轮盘</option>
                  <option value="sicbo">骰宝</option>
                  <option value="bull_bull">牛牛</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">注单状态</label>
                <select id="betStatusFilter" class="form-select form-input-sm">
                  <option value="">全部状态</option>
                  <option value="0">未结算</option>
                  <option value="1">已结算</option>
                  <option value="2">已作废</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">开始日期</label>
                <input type="date" id="betDateFrom" class="form-input form-input-sm" value="${weekAgo}">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">结束日期</label>
                <input type="date" id="betDateTo" class="form-input form-input-sm" value="${today}">
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">最小金额</label>
                <input type="number" id="betMinAmount" class="form-input form-input-sm" placeholder="最小投注额">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">最大金额</label>
                <input type="number" id="betMaxAmount" class="form-input form-input-sm" placeholder="最大投注额">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">代理账号</label>
                <input type="text" id="betAgentSearch" class="form-input form-input-sm" placeholder="输入代理账号">
              </div>
              <div class="col-span-3 flex items-end gap-2">
                <button onclick="searchBets()" class="btn btn-primary btn-sm">
                  <i class="fas fa-search mr-1"></i> 查询
                </button>
                <button onclick="resetBetsFilter()" class="btn btn-secondary btn-sm">
                  <i class="fas fa-undo mr-1"></i> 重置
                </button>
                <button onclick="exportBets()" class="btn btn-success btn-sm">
                  <i class="fas fa-download mr-1"></i> 导出报表
                </button>
              </div>
            </div>
          </div>
          
          <!-- 统计卡片 -->
          <div class="p-4 bg-white border-b">
            <div class="grid grid-4 gap-md" id="betsStatsCards">
              <div class="text-center p-3 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${data.stats?.count || 0}</div>
                <div class="text-xs text-gray-500">总注单数</div>
              </div>
              <div class="text-center p-3 bg-indigo-50 rounded-lg">
                <div class="text-2xl font-bold text-indigo-600">${formatCurrency(data.stats?.total_bet || 0)}</div>
                <div class="text-xs text-gray-500">总投注额</div>
              </div>
              <div class="text-center p-3 bg-purple-50 rounded-lg">
                <div class="text-2xl font-bold text-purple-600">${formatCurrency(data.stats?.total_valid_bet || data.stats?.total_bet || 0)}</div>
                <div class="text-xs text-gray-500">有效投注</div>
              </div>
              <div class="text-center p-3 ${(data.stats?.total_profit || 0) >= 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-lg">
                <div class="text-2xl font-bold ${(data.stats?.total_profit || 0) >= 0 ? 'text-red-600' : 'text-emerald-600'}">${formatCurrency(Math.abs(data.stats?.total_profit || 0))}</div>
                <div class="text-xs text-gray-500">公司${(data.stats?.total_profit || 0) >= 0 ? '盈利' : '亏损'}</div>
              </div>
            </div>
          </div>
          
          <!-- 表格 -->
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>注单号</th>
                  <th>会员账号</th>
                  <th>代理</th>
                  <th>桌台</th>
                  <th class="text-center">游戏类型</th>
                  <th class="text-center">投注项</th>
                  <th class="text-right">投注额</th>
                  <th class="text-right">有效投注</th>
                  <th class="text-right">派彩</th>
                  <th class="text-right">盈亏</th>
                  <th class="text-center">状态</th>
                  <th>投注时间</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody id="betsTableBody">
                ${renderBetsTable(data.data)}
              </tbody>
            </table>
          </div>
          
          <!-- 底部分页 -->
          <div class="card-footer flex justify-between items-center">
            <span class="text-sm text-gray-500">
              共 <span class="font-semibold" id="betsTotalCount">${data.data.length}</span> 条记录
              <span class="ml-4 text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>红色标记：投注额 ≥ ¥50,000</span>
            </span>
            <div class="flex items-center gap-2">
              <select id="betsPageSize" class="form-select form-input-sm" style="width: 80px;" onchange="searchBets()">
                <option value="50">50条</option>
                <option value="100" selected>100条</option>
                <option value="200">200条</option>
              </select>
            </div>
          </div>
        </div>
      `
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败: ' + error.message)}</div>`
    }
  },
  
  // ==========================================
  // 红利与洗码模块 (4个标签页)
  // ==========================================
  async commission() {
    const content = document.getElementById('content')
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <h3>红利与洗码</h3>
            <p>V2.1升级 · 多策略配置 · 自动化结算 · 流水稽查</p>
          </div>
        </div>
        
        <!-- 标签页导航 -->
        <div class="tabs mb-4" style="border-bottom: 1px solid #e5e7eb; padding: 0 1rem;">
          <div class="tab active" onclick="switchCommissionTab('schemes')">
            <i class="fas fa-cogs mr-1"></i>洗码方案
          </div>
          <div class="tab" onclick="switchCommissionTab('pending')">
            <i class="fas fa-clock mr-1"></i>待审核洗码
          </div>
          <div class="tab" onclick="switchCommissionTab('bonus')">
            <i class="fas fa-gift mr-1"></i>红利派发
          </div>
          <div class="tab" onclick="switchCommissionTab('activities')">
            <i class="fas fa-calendar-star mr-1"></i>红利活动
          </div>
          <div class="tab" onclick="switchCommissionTab('turnover')">
            <i class="fas fa-search-dollar mr-1"></i>流水稽查
          </div>
          <div class="tab" onclick="switchCommissionTab('turnover-config')">
            <i class="fas fa-sliders-h mr-1"></i>流水配置
          </div>
        </div>
        
        <!-- 内容区域 -->
        <div id="commissionContent" class="p-4">
          ${showLoading()}
        </div>
      </div>
    `
    
    // 默认加载洗码方案
    loadCommissionSchemes()
  },
  
  // ==========================================
  // 风险控端模块 (3个标签页)
  // ==========================================
  async risk() {
    const content = document.getElementById('content')
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <h3>风险控端</h3>
            <p>实时监控 · 大额预警 · 套利识别 · 规则配置</p>
          </div>
        </div>
        
        <!-- 标签页导航 -->
        <div class="tabs mb-4" style="border-bottom: 1px solid #e5e7eb; padding: 0 1rem;">
          <div class="tab active" onclick="switchRiskTab('alerts')">
            <i class="fas fa-exclamation-triangle mr-1"></i>风险预警
          </div>
          <div class="tab" onclick="switchRiskTab('limits')">
            <i class="fas fa-sliders-h mr-1"></i>限红配置
          </div>
          <div class="tab" onclick="switchRiskTab('rules')">
            <i class="fas fa-cog mr-1"></i>风控规则
          </div>
        </div>
        
        <!-- 内容区域 -->
        <div id="riskContent" class="p-4">
          ${showLoading()}
        </div>
      </div>
    `
    
    // 默认加载风险预警
    loadRiskAlerts()
  },
  
  // ==========================================
  // 现场运营模块
  // ==========================================
  async studio() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    try {
      const [dealers, tables, shifts] = await Promise.all([
        API.get('/dealers'),
        API.get('/tables'),
        API.get('/shifts')
      ])
      
      content.innerHTML = `
        <!-- 桌台状态 -->
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-header-title">
              <h3>
                桌台状态
                <span class="badge badge-success ml-2">NEW</span>
              </h3>
              <p>V2.1 新增 · 实时监控 · 视频流状态</p>
            </div>
            <div class="card-header-actions">
              <button onclick="showAddTableModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus"></i> 新增桌台
              </button>
            </div>
          </div>
          
          <div class="card-body">
            <div class="grid grid-3 gap-lg">
              ${tables.data.map(table => `
                <div class="info-card">
                  <div class="info-card-header">
                    <div>
                      <div class="info-card-title">${escapeHtml(table.table_name)}</div>
                      <div class="text-xs text-gray-400 font-mono">${escapeHtml(table.table_code)}</div>
                    </div>
                    ${getStatusBadge(table.status, 'table')}
                  </div>
                  <div class="info-card-footer mt-4">
                    <div class="info-card-row">
                      <span class="info-card-row-label">当前荷官</span>
                      <span class="info-card-row-value ${table.dealer_name ? '' : 'text-amber-600'}">${escapeHtml(table.dealer_name) || '未排班'}</span>
                    </div>
                    <div class="info-card-row">
                      <span class="info-card-row-label">限红范围</span>
                      <span class="info-card-row-value font-mono text-xs">${formatCurrency(table.min_bet)} - ${formatCurrency(table.max_bet)}</span>
                    </div>
                    <div class="info-card-row">
                      <span class="info-card-row-label">限红组</span>
                      <span class="badge badge-info badge-sm">${table.limit_group || 'A组'}</span>
                    </div>
                  </div>
                  ${table.status === 1 ? `
                    <div class="mt-4 pt-4 border-t flex items-center justify-between">
                      <span class="live-indicator">
                        <span class="live-indicator-dot"></span>
                        视频流正常
                      </span>
                      <button onclick="editTable(${table.id})" class="btn btn-primary btn-xs">管理</button>
                    </div>
                  ` : `
                    <div class="mt-4 pt-4 border-t">
                      <button onclick="editTable(${table.id})" class="btn btn-primary btn-xs w-full">管理桌台</button>
                    </div>
                  `}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <!-- 荷官列表 -->
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-header-title">
              <h3>荷官档案库</h3>
            </div>
            <div class="card-header-actions">
              <button onclick="showAddDealerModal()" class="btn btn-success btn-sm">
                <i class="fas fa-user-plus"></i> 新增荷官
              </button>
            </div>
          </div>
          
          <div class="card-body">
            <div class="grid grid-5 gap-lg">
              ${dealers.data.map(dealer => {
                const colors = ['from-indigo-400 to-purple-500', 'from-pink-400 to-rose-500', 'from-cyan-400 to-blue-500', 'from-emerald-400 to-teal-500', 'from-amber-400 to-orange-500']
                const color = colors[dealer.id % colors.length]
                
                return `
                  <div class="info-card text-center cursor-pointer hover:shadow-lg" onclick="viewDealerDetail(${dealer.id})">
                    <div class="avatar avatar-xl mx-auto mb-3 bg-gradient-to-br ${color}">
                      ${dealer.stage_name.charAt(0)}
                    </div>
                    <div class="font-semibold mb-1">${escapeHtml(dealer.stage_name)}</div>
                    <div class="text-xs text-gray-400 mb-3">${escapeHtml(dealer.employee_no)}</div>
                    <div class="flex items-center justify-center gap-1 mb-3">
                      <i class="fas fa-star text-amber-400 text-sm"></i>
                      <span class="font-semibold">${dealer.rating || '5.0'}</span>
                    </div>
                    ${getStatusBadge(dealer.status, 'dealer')}
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
        
        <!-- 今日排班 -->
        <div class="card">
          <div class="card-header">
            <div class="card-header-title">
              <h3>今日排班</h3>
              <p>${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
            </div>
            <div class="card-header-actions">
              <button onclick="showAddShiftModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus"></i> 新增排班
              </button>
            </div>
          </div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>荷官</th>
                  <th>工号</th>
                  <th>桌台</th>
                  <th>开始时间</th>
                  <th>结束时间</th>
                  <th class="text-center">状态</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                ${shifts.data.length === 0 ? `<tr><td colspan="7">${showEmpty('calendar-alt', '今日暂无排班')}</td></tr>` :
                  shifts.data.map(shift => `
                  <tr>
                    <td class="font-semibold">${escapeHtml(shift.stage_name)}</td>
                    <td class="text-gray-500 font-mono">${escapeHtml(shift.employee_no)}</td>
                    <td>${escapeHtml(shift.table_name)} <span class="text-xs text-gray-400">(${escapeHtml(shift.table_code)})</span></td>
                    <td>${formatDate(shift.start_time)}</td>
                    <td>${formatDate(shift.end_time)}</td>
                    <td class="text-center">
                      <span class="badge ${shift.status === 2 ? 'badge-success' : shift.status === 3 ? 'badge-gray' : 'badge-info'}">
                        ${shift.status === 1 ? '已排班' : shift.status === 2 ? '进行中' : shift.status === 3 ? '已完成' : '已取消'}
                      </span>
                    </td>
                    <td class="text-center">
                      <button onclick="editShift(${shift.id})" class="btn btn-primary btn-xs">编辑</button>
                      ${shift.status === 1 ? `<button onclick="cancelShift(${shift.id})" class="btn btn-danger btn-xs">取消</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败')}</div>`
    }
  },
  
  // ==========================================
  // 报表中心模块 - 完善版
  // ==========================================
  async reports() {
    const content = document.getElementById('content')
    content.innerHTML = showLoading()
    
    const today = new Date().toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    try {
      content.innerHTML = `
        <div class="card mb-6">
          <div class="card-header">
            <div class="card-header-title">
              <h3><i class="fas fa-chart-bar mr-2"></i>报表中心</h3>
              <p>多维度数据分析 · 盈亏报表 · 结算对账</p>
            </div>
          </div>
          
          <!-- 报表类型标签页 -->
          <div class="tabs">
            <div class="tab active" onclick="switchReportTab('daily')">
              <i class="fas fa-calendar-day mr-1"></i>日报表
            </div>
            <div class="tab" onclick="switchReportTab('shareholder')">
              <i class="fas fa-user-tie mr-1"></i>股东报表
            </div>
            <div class="tab" onclick="switchReportTab('agent')">
              <i class="fas fa-users mr-1"></i>代理报表
            </div>
            <div class="tab" onclick="switchReportTab('player')">
              <i class="fas fa-user mr-1"></i>会员报表
            </div>
            <div class="tab" onclick="switchReportTab('game')">
              <i class="fas fa-dice mr-1"></i>游戏报表
            </div>
            <div class="tab" onclick="switchReportTab('commission')">
              <i class="fas fa-coins mr-1"></i>佣金报表
            </div>
            <div class="tab" onclick="switchReportTab('transfers')">
              <i class="fas fa-exchange-alt mr-1"></i>转账记录
            </div>
            <div class="tab" onclick="switchReportTab('fee-settings')">
              <i class="fas fa-cog mr-1"></i>手续费设置
            </div>
          </div>
          
          <!-- 报表内容区域 -->
          <div id="reportContent" class="p-4">
            ${showLoading()}
          </div>
        </div>
      `
      
      // 默认加载日报表
      loadDailyReport()
    } catch (error) {
      content.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败: ' + error.message)}</div>`
    }
  },
  
  // ==========================================
  // 内容管理模块
  // ==========================================
  async content() {
    const contentEl = document.getElementById('content')
    contentEl.innerHTML = showLoading()
    
    try {
      const data = await API.get('/announcements')
      
      contentEl.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-header-title">
              <h3>公告管理</h3>
              <p>系统公告 · 活动通知 · 维护公告</p>
            </div>
            <div class="card-header-actions">
              <button onclick="showAnnouncementModal()" class="btn btn-success btn-sm">
                <i class="fas fa-plus"></i> 发布公告
              </button>
            </div>
          </div>
          
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th class="text-center">类型</th>
                  <th class="text-center">语言</th>
                  <th class="text-center">状态</th>
                  <th>创建时间</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                ${data.data.length === 0 ? `<tr><td colspan="7">${showEmpty('bullhorn', '暂无公告')}</td></tr>` :
                  data.data.map(a => `
                  <tr>
                    <td class="font-mono text-gray-500">${a.id}</td>
                    <td class="font-semibold">${a.title}</td>
                    <td class="text-center">
                      <span class="badge ${a.announcement_type === 'important' ? 'badge-danger' : a.announcement_type === 'activity' ? 'badge-success' : 'badge-info'}">
                        ${a.announcement_type === 'important' ? '重要' : a.announcement_type === 'activity' ? '活动' : '系统'}
                      </span>
                    </td>
                    <td class="text-center">${a.language || 'zh-CN'}</td>
                    <td class="text-center">${getStatusBadge(a.status, 'announcement')}</td>
                    <td class="text-gray-500 text-sm">${formatShortDate(a.created_at)}</td>
                    <td class="text-center">
                      <div class="flex items-center justify-center gap-2">
                        <button onclick="editAnnouncement(${a.id})" class="btn btn-primary btn-xs">编辑</button>
                        <button onclick="deleteAnnouncement(${a.id})" class="btn btn-danger btn-xs">删除</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
    } catch (error) {
      contentEl.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败')}</div>`
    }
  },
  
  // ==========================================
  // 系统设置模块 (8个标签页)
  // ==========================================
  async settings() {
    const content = document.getElementById('content')
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-header-title">
            <h3>系统设置</h3>
            <p>个人信息 · 权限管理 · 安全设置 · 操作日志</p>
          </div>
        </div>
        
        <!-- 标签页导航 -->
        <div class="tabs mb-4" style="border-bottom: 1px solid #e5e7eb; padding: 0 1rem;">
          <div class="tab active" onclick="switchSettingsTab('profile')">
            <i class="fas fa-user mr-1"></i>个人信息
          </div>
          <div class="tab" onclick="switchSettingsTab('password')">
            <i class="fas fa-key mr-1"></i>修改密码
          </div>
          <div class="tab" onclick="switchSettingsTab('2fa')">
            <i class="fas fa-shield-alt mr-1"></i>2FA设置
          </div>
          <div class="tab" onclick="switchSettingsTab('ip-whitelist')">
            <i class="fas fa-network-wired mr-1"></i>IP白名单
          </div>
          <div class="tab" onclick="switchSettingsTab('admins')">
            <i class="fas fa-users-cog mr-1"></i>管理员账号
          </div>
          <div class="tab" onclick="switchSettingsTab('roles')">
            <i class="fas fa-user-shield mr-1"></i>角色权限
          </div>
          <div class="tab" onclick="switchSettingsTab('operation-logs')">
            <i class="fas fa-history mr-1"></i>操作日志
          </div>
          <div class="tab" onclick="switchSettingsTab('login-logs')">
            <i class="fas fa-sign-in-alt mr-1"></i>登录日志
          </div>
        </div>
        
        <!-- 内容区域 -->
        <div id="settingsContent" class="p-4">
          ${showLoading()}
        </div>
      </div>
    `
    
    // 默认加载个人信息
    loadSettingsProfile()
  }
}

// ============================================
// 图表渲染
// ============================================

function renderTrendChart(data) {
  const ctx = document.getElementById('trendChart')
  if (!ctx) return
  
  // 销毁旧图表
  if (AppState.chartInstances.trend) {
    AppState.chartInstances.trend.destroy()
  }
  
  const labels = data.map(d => {
    const date = new Date(d.date)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })
  
  AppState.chartInstances.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '投注额',
          data: data.map(d => d.amount || 0),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: '公司盈利',
          data: data.map(d => d.platform_win || 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '¥' + (value / 10000).toFixed(0) + '万'
            }
          }
        }
      }
    }
  })
}

// ============================================
// 操作函数
// ============================================

// 玩家操作
async function viewPlayerDetail(id) {
  try {
    const data = await API.get(`/players/${id}`)
    const player = data.data
    
    const content = `
      <div class="grid grid-2 gap-lg mb-6">
        <div>
          <h4 class="font-semibold mb-3">基本信息</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">用户ID</span><span class="font-mono">${player.id}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">账号</span><span class="font-semibold">${escapeHtml(player.username)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">昵称</span><span>${escapeHtml(player.nickname || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">真实姓名</span><span>${escapeHtml(player.real_name || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">手机号</span><span>${escapeHtml(player.phone || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">VIP等级</span><span class="badge badge-warning">VIP ${player.vip_level}</span></div>
          </div>
        </div>
        <div>
          <h4 class="font-semibold mb-3">账户信息</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">余额</span><span class="font-semibold text-emerald-600">${formatCurrency(player.balance)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">累计存款</span><span>${formatCurrency(player.totalDeposit)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">累计提款</span><span>${formatCurrency(player.totalWithdrawal)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">状态</span>${getStatusBadge(player.status, 'player')}</div>
            <div class="flex justify-between"><span class="text-gray-500">KYC状态</span><span class="badge ${player.kyc_status ? 'badge-success' : 'badge-warning'}">${player.kyc_status ? '已认证' : '未认证'}</span></div>
          </div>
        </div>
      </div>
      
      ${player.tags && player.tags.length > 0 ? `
        <div class="mb-6">
          <h4 class="font-semibold mb-3">玩家标签</h4>
          <div class="flex flex-wrap gap-2">
            ${player.tags.map(t => `<span class="badge badge-info">${t.tag}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="flex flex-wrap gap-2">
        <button onclick="showDepositModal(${player.id})" class="btn btn-success btn-sm"><i class="fas fa-plus mr-1"></i>存款</button>
        <button onclick="showWithdrawModal(${player.id})" class="btn btn-danger btn-sm"><i class="fas fa-minus mr-1"></i>提款</button>
        <button onclick="showAdjustmentModal(${player.id})" class="btn btn-secondary btn-sm"><i class="fas fa-balance-scale mr-1"></i>调账</button>
        <button onclick="togglePlayerStatus(${player.id}, ${player.status})" class="btn ${player.status === 1 ? 'btn-warning' : 'btn-success'} btn-sm">
          ${player.status === 1 ? '<i class="fas fa-lock mr-1"></i>冻结' : '<i class="fas fa-unlock mr-1"></i>解冻'}
        </button>
      </div>
      <div class="flex flex-wrap gap-2 mt-2">
        <button onclick="closeAllModals();kickPlayer(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-sign-out-alt mr-1"></i>踢线</button>
        <button onclick="closeAllModals();showTransferAgentModal(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-exchange-alt mr-1"></i>转移代理</button>
        <button onclick="closeAllModals();showBindSchemeModal(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-link mr-1"></i>绑定洗码</button>
        <button onclick="closeAllModals();showPlayerTransactions(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-list mr-1"></i>流水</button>
        <button onclick="closeAllModals();showPlayerBets(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-dice mr-1"></i>注单</button>
        <button onclick="closeAllModals();showPlayerLTV(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-chart-pie mr-1"></i>LTV</button>
        <button onclick="closeAllModals();showRiskLevelModal(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-exclamation-triangle mr-1"></i>风险</button>
        <button onclick="closeAllModals();showLimitGroupModal(${player.id})" class="btn btn-outline btn-sm"><i class="fas fa-sliders-h mr-1"></i>限红组</button>
      </div>
    `
    
    showModal(`玩家详情 - ${escapeHtml(player.username)}`, content, { width: '750px' })
  } catch (error) {
    showNotification('获取玩家详情失败', 'danger')
  }
}

async function togglePlayerStatus(id, currentStatus) {
  const action = currentStatus === 1 ? 'freeze' : 'unfreeze'
  const confirmMsg = currentStatus === 1 ? '确定要冻结该玩家吗？' : '确定要解冻该玩家吗？'
  
  if (!confirm(confirmMsg)) return
  
  try {
    await API.post(`/players/${id}/status`, { action })
    showNotification(`玩家已${action === 'freeze' ? '冻结' : '解冻'}`, 'success')
    loadModule('players')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

async function searchPlayers() {
  const search = document.getElementById('playerSearch')?.value || ''
  const status = document.getElementById('statusFilter')?.value || ''
  const vipLevel = document.getElementById('vipFilter')?.value || ''
  
  try {
    const data = await API.get('/players', { search, status, vip_level: vipLevel })
    // 重新渲染表格...
    loadModule('players')
  } catch (error) {
    showNotification('搜索失败', 'danger')
  }
}

// 提款审核
async function reviewWithdrawal(id, action) {
  const confirmMsg = action === 'approve' ? '确定要通过该提款申请吗？' : '确定要拒绝该提款申请吗？'
  if (!confirm(confirmMsg)) return
  
  try {
    await API.post(`/withdrawals/${id}/review`, { action })
    showNotification(`提款已${action === 'approve' ? '批准' : '拒绝'}`, 'success')
    loadModule('finance')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// 洗码审核
async function reviewCommission(id, action) {
  const confirmMsg = action === 'approve' ? '确定要发放该洗码吗？' : '确定要拒绝该洗码吗？'
  if (!confirm(confirmMsg)) return
  
  try {
    await API.post(`/commission/${id}/review`, { action })
    showNotification(`洗码已${action === 'approve' ? '发放' : '拒绝'}`, 'success')
    loadModule('commission')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// 风险预警处理
async function handleRiskAlert(id, action) {
  try {
    await API.post(`/risk/alerts/${id}/handle`, { action })
    showNotification('预警已处理', 'success')
    loadModule('risk')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// 注单作废
async function voidBet(id) {
  const reason = prompt('请输入作废原因:')
  if (!reason) return
  
  const password = prompt('请输入二级密码:')
  if (!password) return
  
  try {
    await API.post(`/bets/${id}/void`, { reason, secondary_password: password })
    showNotification('注单已作废', 'success')
    loadModule('bets')
  } catch (error) {
    showNotification('作废失败', 'danger')
  }
}

// 模态框
function showDepositModal(playerId = null) {
  const content = `
    <form onsubmit="submitDeposit(event)">
      <div class="form-group">
        <label class="form-label">玩家ID</label>
        <input type="number" id="depositPlayerId" class="form-input" value="${playerId || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">存款金额</label>
        <input type="number" id="depositAmount" class="form-input" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label class="form-label">支付方式</label>
        <select id="depositMethod" class="form-select">
          <option value="manual">人工存款</option>
          <option value="bank_transfer">银行转账</option>
          <option value="alipay">支付宝</option>
          <option value="wechat">微信</option>
          <option value="usdt">USDT</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <input type="text" id="depositRemark" class="form-input">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-success flex-1">确认存款</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('人工存款', content, { width: '400px' })
}

async function submitDeposit(e) {
  e.preventDefault()
  
  const data = {
    player_id: parseInt(document.getElementById('depositPlayerId').value),
    amount: parseFloat(document.getElementById('depositAmount').value),
    payment_method: document.getElementById('depositMethod').value,
    remark: document.getElementById('depositRemark').value
  }
  
  try {
    await API.post('/deposits', data)
    showNotification('存款成功', 'success')
    closeAllModals()
    if (AppState.currentModule === 'finance') loadModule('finance')
  } catch (error) {
    showNotification('存款失败', 'danger')
  }
}

function showWithdrawModal(playerId = null) {
  const content = `
    <form onsubmit="submitWithdraw(event)">
      <div class="form-group">
        <label class="form-label">玩家ID</label>
        <input type="number" id="withdrawPlayerId" class="form-input" value="${playerId || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">提款金额</label>
        <input type="number" id="withdrawAmount" class="form-input" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label class="form-label">银行名称</label>
        <input type="text" id="withdrawBankName" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">银行账号</label>
        <input type="text" id="withdrawBankAccount" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">账户名</label>
        <input type="text" id="withdrawAccountName" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <input type="text" id="withdrawRemark" class="form-input">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-danger flex-1">确认提款</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('人工提款', content, { width: '400px' })
}

async function submitWithdraw(e) {
  e.preventDefault()
  
  const data = {
    player_id: parseInt(document.getElementById('withdrawPlayerId').value),
    amount: parseFloat(document.getElementById('withdrawAmount').value),
    bank_name: document.getElementById('withdrawBankName').value,
    bank_account: document.getElementById('withdrawBankAccount').value,
    account_name: document.getElementById('withdrawAccountName').value,
    remark: document.getElementById('withdrawRemark').value
  }
  
  try {
    await API.post('/withdrawals', data)
    showNotification('提款成功', 'success')
    closeAllModals()
    if (AppState.currentModule === 'finance') loadModule('finance')
  } catch (error) {
    showNotification('提款失败', 'danger')
  }
}

function showAdjustmentModal(playerId = null) {
  const content = `
    <form onsubmit="submitAdjustment(event)">
      <div class="form-group">
        <label class="form-label">玩家ID</label>
        <input type="number" id="adjustPlayerId" class="form-input" value="${playerId || ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">调账类型</label>
        <select id="adjustType" class="form-select">
          <option value="add">加款</option>
          <option value="deduct">扣款</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">调账金额</label>
        <input type="number" id="adjustAmount" class="form-input" step="0.01" min="0" required>
      </div>
      <div class="form-group">
        <label class="form-label">调账原因</label>
        <input type="text" id="adjustRemark" class="form-input" required>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">确认调账</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('人工调账', content, { width: '400px' })
}

async function submitAdjustment(e) {
  e.preventDefault()
  
  const data = {
    player_id: parseInt(document.getElementById('adjustPlayerId').value),
    type: document.getElementById('adjustType').value,
    amount: parseFloat(document.getElementById('adjustAmount').value),
    remark: document.getElementById('adjustRemark').value
  }
  
  try {
    await API.post('/finance/adjustment', data)
    showNotification('调账成功', 'success')
    closeAllModals()
  } catch (error) {
    showNotification('调账失败', 'danger')
  }
}

function showAnnouncementModal() {
  const content = `
    <form onsubmit="submitAnnouncement(event)">
      <div class="form-group">
        <label class="form-label">公告标题</label>
        <input type="text" id="announcementTitle" class="form-input" required>
      </div>
      <div class="form-group">
        <label class="form-label">公告类型</label>
        <select id="announcementType" class="form-select">
          <option value="system">系统公告</option>
          <option value="activity">活动公告</option>
          <option value="important">重要公告</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">公告内容</label>
        <textarea id="announcementContent" class="form-input" rows="4" required></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">状态</label>
        <select id="announcementStatus" class="form-select">
          <option value="0">草稿</option>
          <option value="1">发布</option>
        </select>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-success flex-1">发布公告</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('发布公告', content, { width: '500px' })
}

async function submitAnnouncement(e) {
  e.preventDefault()
  
  const data = {
    title: document.getElementById('announcementTitle').value,
    announcement_type: document.getElementById('announcementType').value,
    content: document.getElementById('announcementContent').value,
    status: parseInt(document.getElementById('announcementStatus').value)
  }
  
  try {
    await API.post('/announcements', data)
    showNotification('公告发布成功', 'success')
    closeAllModals()
    if (AppState.currentModule === 'content') loadModule('content')
  } catch (error) {
    showNotification('发布失败', 'danger')
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('确定要删除该公告吗？')) return
  
  try {
    await API.delete(`/announcements/${id}`)
    showNotification('公告已删除', 'success')
    loadModule('content')
  } catch (error) {
    showNotification('删除失败', 'danger')
  }
}

// ============================================
// 完整功能实现 - 玩家管理
// ============================================

// 新增玩家
function showAddPlayerModal() {
  const content = `
    <form onsubmit="submitAddPlayer(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">用户名 *</label>
          <input type="text" id="newPlayerUsername" class="form-input" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+">
          <small class="text-gray-400">3-32位字母数字下划线</small>
        </div>
        <div class="form-group">
          <label class="form-label">密码 *</label>
          <input type="password" id="newPlayerPassword" class="form-input" required minlength="6">
        </div>
        <div class="form-group">
          <label class="form-label">昵称</label>
          <input type="text" id="newPlayerNickname" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">真实姓名</label>
          <input type="text" id="newPlayerRealName" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input type="tel" id="newPlayerPhone" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">邮箱</label>
          <input type="email" id="newPlayerEmail" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">所属代理ID</label>
          <input type="number" id="newPlayerAgentId" class="form-input" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">VIP等级</label>
          <select id="newPlayerVipLevel" class="form-select">
            <option value="0">VIP 0</option>
            <option value="1">VIP 1</option>
            <option value="2">VIP 2</option>
            <option value="3">VIP 3</option>
            <option value="4">VIP 4</option>
            <option value="5">VIP 5</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建玩家</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增玩家', content, { width: '600px' })
}

async function submitAddPlayer(e) {
  e.preventDefault()
  try {
    await API.post('/players', {
      username: document.getElementById('newPlayerUsername').value,
      password: document.getElementById('newPlayerPassword').value,
      nickname: document.getElementById('newPlayerNickname').value,
      real_name: document.getElementById('newPlayerRealName').value,
      phone: document.getElementById('newPlayerPhone').value,
      email: document.getElementById('newPlayerEmail').value,
      agent_id: document.getElementById('newPlayerAgentId').value || null,
      vip_level: parseInt(document.getElementById('newPlayerVipLevel').value)
    })
    showNotification('玩家创建成功', 'success')
    closeAllModals()
    loadModule('players')
  } catch (error) {
    showNotification('创建失败: ' + (error.response?.data?.error || error.message), 'danger')
  }
}

// 玩家踢线
async function kickPlayer(id) {
  const reason = prompt('请输入踢线原因(可选):')
  if (reason === null) return
  
  try {
    await API.post(`/players/${id}/kick`, { reason })
    showNotification('玩家已强制下线', 'success')
    loadModule('players')
  } catch (error) {
    showNotification('踢线失败', 'danger')
  }
}

// 玩家代理转移
async function showTransferAgentModal(playerId) {
  try {
    const agentsData = await API.get('/agents', { limit: 100 })
    const agents = agentsData.data || []
    
    const content = `
      <form onsubmit="submitTransferAgent(event, ${playerId})">
        <div class="form-group">
          <label class="form-label">选择目标代理</label>
          <select id="transferAgentId" class="form-select" required>
            <option value="">-- 请选择代理 --</option>
            <option value="0">无代理(直属公司)</option>
            ${agents.map(a => `<option value="${a.id}">${a.username} (${['股东','总代','代理'][a.agent_level-1] || '代理'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">转移原因</label>
          <textarea id="transferReason" class="form-input" rows="3" placeholder="请输入转移原因..."></textarea>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">确认转移</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('玩家代理转移', content, { width: '450px' })
  } catch (error) {
    showNotification('获取代理列表失败', 'danger')
  }
}

async function submitTransferAgent(e, playerId) {
  e.preventDefault()
  try {
    const newAgentId = document.getElementById('transferAgentId').value
    await API.post(`/players/${playerId}/transfer`, {
      new_agent_id: newAgentId === '0' ? null : parseInt(newAgentId),
      reason: document.getElementById('transferReason').value
    })
    showNotification('代理转移成功', 'success')
    closeAllModals()
    loadModule('players')
  } catch (error) {
    showNotification('转移失败', 'danger')
  }
}

// 洗码方案绑定
async function showBindSchemeModal(playerId) {
  try {
    const schemesData = await API.get('/commission/schemes')
    const schemes = schemesData.data || []
    
    const content = `
      <form onsubmit="submitBindScheme(event, ${playerId})">
        <div class="form-group">
          <label class="form-label">选择洗码方案</label>
          <select id="bindSchemeId" class="form-select" required>
            <option value="">-- 请选择方案 --</option>
            <option value="0">取消绑定</option>
            ${schemes.map(s => `<option value="${s.id}">${s.scheme_name} (${s.settle_type === 'daily' ? '日结' : s.settle_type === 'weekly' ? '周结' : '月结'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">绑定原因</label>
          <input type="text" id="bindSchemeReason" class="form-input" placeholder="VIP客户特殊方案...">
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">确认绑定</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('绑定洗码方案', content, { width: '450px' })
  } catch (error) {
    showNotification('获取方案列表失败', 'danger')
  }
}

async function submitBindScheme(e, playerId) {
  e.preventDefault()
  try {
    const schemeId = document.getElementById('bindSchemeId').value
    await API.post(`/players/${playerId}/bindScheme`, {
      scheme_id: schemeId === '0' ? null : parseInt(schemeId),
      reason: document.getElementById('bindSchemeReason').value
    })
    showNotification('洗码方案绑定成功', 'success')
    closeAllModals()
    loadModule('players')
  } catch (error) {
    showNotification('绑定失败', 'danger')
  }
}

// 设置玩家风险等级
function showRiskLevelModal(playerId) {
  const content = `
    <form onsubmit="submitRiskLevel(event, ${playerId})">
      <div class="form-group">
        <label class="form-label">风险等级</label>
        <select id="riskLevel" class="form-select" required>
          <option value="0">0 - 普通用户</option>
          <option value="1">1 - 低风险(关注)</option>
          <option value="2">2 - 中风险(观察)</option>
          <option value="3">3 - 高风险(重点)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">标记原因</label>
        <textarea id="riskReason" class="form-input" rows="3" placeholder="套利嫌疑/刷水行为/异常投注..." required></textarea>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-warning flex-1">设置风险等级</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('设置风险等级', content, { width: '400px' })
}

async function submitRiskLevel(e, playerId) {
  e.preventDefault()
  try {
    await API.post(`/players/${playerId}/riskLevel`, {
      risk_level: parseInt(document.getElementById('riskLevel').value),
      reason: document.getElementById('riskReason').value
    })
    showNotification('风险等级设置成功', 'success')
    closeAllModals()
    loadModule('players')
  } catch (error) {
    showNotification('设置失败', 'danger')
  }
}

// 设置玩家限红组
function showLimitGroupModal(playerId) {
  const content = `
    <form onsubmit="submitLimitGroup(event, ${playerId})">
      <div class="form-group">
        <label class="form-label">限红组</label>
        <select id="limitGroup" class="form-select" required>
          <option value="A">A组 - 普通玩家</option>
          <option value="B">B组 - 高级玩家</option>
          <option value="C">C组 - VIP玩家</option>
          <option value="VIP">VIP组 - 贵宾</option>
          <option value="SVIP">SVIP组 - 超级贵宾</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">调整原因</label>
        <input type="text" id="limitGroupReason" class="form-input" placeholder="VIP升级/特殊客户...">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">设置限红组</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('设置限红组', content, { width: '400px' })
}

async function submitLimitGroup(e, playerId) {
  e.preventDefault()
  try {
    await API.post(`/players/${playerId}/limitGroup`, {
      limit_group: document.getElementById('limitGroup').value,
      reason: document.getElementById('limitGroupReason').value
    })
    showNotification('限红组设置成功', 'success')
    closeAllModals()
    loadModule('players')
  } catch (error) {
    showNotification('设置失败', 'danger')
  }
}

// 查看玩家流水
async function showPlayerTransactions(playerId) {
  try {
    const data = await API.get(`/players/${playerId}/transactions`, { limit: 50 })
    const transactions = data.data || []
    
    const content = `
      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>金额</th>
              <th>前余额</th>
              <th>后余额</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.length ? transactions.map(t => `
              <tr>
                <td>${formatDate(t.created_at)}</td>
                <td>${getTransactionTypeName(t.transaction_type)}</td>
                <td class="${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}">${t.amount >= 0 ? '+' : ''}${formatCurrency(t.amount)}</td>
                <td>${formatCurrency(t.balance_before)}</td>
                <td>${formatCurrency(t.balance_after)}</td>
                <td class="text-gray-500">${escapeHtml(t.remark || '-')}</td>
              </tr>
            `).join('') : '<tr><td colspan="6" class="text-center text-gray-400">暂无流水记录</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    showModal('玩家流水记录', content, { width: '900px' })
  } catch (error) {
    showNotification('获取流水失败', 'danger')
  }
}

// 查看玩家注单
async function showPlayerBets(playerId) {
  try {
    const data = await API.get(`/players/${playerId}/bets`, { limit: 50 })
    const bets = data.data || []
    
    const content = `
      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>注单号</th>
              <th>游戏</th>
              <th>投注额</th>
              <th>有效投注</th>
              <th>盈亏</th>
              <th>状态</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${bets.length ? bets.map(b => `
              <tr>
                <td class="font-mono text-sm">${escapeHtml(b.bet_no)}</td>
                <td>${getGameTypeName(b.game_type)}</td>
                <td>${formatCurrency(b.bet_amount)}</td>
                <td>${formatCurrency(b.valid_bet)}</td>
                <td class="${b.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}">${b.profit_loss >= 0 ? '+' : ''}${formatCurrency(b.profit_loss)}</td>
                <td>${getStatusBadge(b.status, 'bet')}</td>
                <td>${formatShortDate(b.bet_at)}</td>
              </tr>
            `).join('') : '<tr><td colspan="7" class="text-center text-gray-400">暂无注单记录</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    showModal('玩家注单记录', content, { width: '1000px' })
  } catch (error) {
    showNotification('获取注单失败', 'danger')
  }
}

// 查看玩家LTV
async function showPlayerLTV(playerId) {
  try {
    const data = await API.get(`/players/${playerId}/ltv`)
    const ltv = data.data
    
    const content = `
      <div class="grid grid-2 gap-lg">
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-semibold mb-3 text-gray-600">存取款统计</h4>
          <div class="space-y-2">
            <div class="flex justify-between"><span>累计存款</span><span class="text-emerald-600 font-semibold">${formatCurrency(ltv.total_deposit)}</span></div>
            <div class="flex justify-between"><span>存款次数</span><span>${ltv.deposit_count}次</span></div>
            <div class="flex justify-between"><span>累计提款</span><span class="text-red-600 font-semibold">${formatCurrency(ltv.total_withdrawal)}</span></div>
            <div class="flex justify-between"><span>提款次数</span><span>${ltv.withdrawal_count}次</span></div>
            <div class="flex justify-between border-t pt-2"><span>净存款</span><span class="font-bold ${ltv.net_deposit >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(ltv.net_deposit)}</span></div>
          </div>
        </div>
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-semibold mb-3 text-gray-600">投注统计</h4>
          <div class="space-y-2">
            <div class="flex justify-between"><span>累计投注</span><span>${formatCurrency(ltv.total_bet)}</span></div>
            <div class="flex justify-between"><span>有效投注</span><span>${formatCurrency(ltv.valid_bet)}</span></div>
            <div class="flex justify-between"><span>投注次数</span><span>${ltv.bet_count}次</span></div>
            <div class="flex justify-between"><span>玩家盈亏</span><span class="${ltv.player_profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(ltv.player_profit_loss)}</span></div>
            <div class="flex justify-between"><span>累计洗码</span><span class="text-orange-600">${formatCurrency(ltv.total_commission)}</span></div>
          </div>
        </div>
      </div>
      <div class="bg-blue-50 rounded-lg p-4 mt-4">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="font-semibold text-blue-800">公司净收益</h4>
            <p class="text-sm text-blue-600">玩家贡献价值(LTV)</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold ${ltv.company_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(ltv.company_profit)}</div>
            <div class="text-sm text-gray-500">活跃${ltv.active_days}天 · 评分${ltv.ltv_score}</div>
          </div>
        </div>
      </div>
    `
    showModal(`玩家LTV分析 - ${ltv.username}`, content, { width: '600px' })
  } catch (error) {
    showNotification('获取LTV数据失败', 'danger')
  }
}

// ============================================
// 完整功能实现 - 代理管理
// ============================================

function showAddAgentModal() {
  const content = `
    <form onsubmit="submitAddAgent(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">代理账号 *</label>
          <input type="text" id="newAgentUsername" class="form-input" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+" placeholder="字母、数字、下划线">
        </div>
        <div class="form-group">
          <label class="form-label">密码 *</label>
          <input type="password" id="newAgentPassword" class="form-input" required minlength="6">
        </div>
        <div class="form-group">
          <label class="form-label">代理级别 *</label>
          <select id="newAgentLevel" class="form-select" required>
            <option value="1">股东</option>
            <option value="2">总代</option>
            <option value="3" selected>代理</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">上级代理ID</label>
          <input type="number" id="newAgentParentId" class="form-input" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">占成比例(%)</label>
          <input type="number" id="newAgentProfitShare" class="form-input" step="0.01" min="0" max="100" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">洗码率(%)</label>
          <input type="number" id="newAgentCommissionRate" class="form-input" step="0.0001" min="0" max="5" value="0">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">
            <i class="fas fa-globe mr-1"></i>专属域名
            <span class="text-gray-400 text-sm ml-1">(可选)</span>
          </label>
          <input type="text" id="newAgentCustomDomain" class="form-input" placeholder="例如: agent.example.com">
          <p class="text-gray-400 text-xs mt-1">绑定专属域名后，用户可通过该域名访问注册页面自动关联到此代理</p>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建代理</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增股东/代理', content, { width: '600px' })
}

async function submitAddAgent(e) {
  e.preventDefault()
  try {
    const customDomain = document.getElementById('newAgentCustomDomain').value.trim()
    const result = await API.post('/agents', {
      username: document.getElementById('newAgentUsername').value,
      password: document.getElementById('newAgentPassword').value,
      agent_level: parseInt(document.getElementById('newAgentLevel').value),
      parent_id: document.getElementById('newAgentParentId').value || null,
      profit_share: parseFloat(document.getElementById('newAgentProfitShare').value),
      commission_rate: parseFloat(document.getElementById('newAgentCommissionRate').value) / 100,
      custom_domain: customDomain || null
    })
    showNotification(`代理创建成功，分享码: ${result.share_code}`, 'success')
    closeAllModals()
    loadModule('agents')
  } catch (error) {
    showNotification(error.response?.data?.error || '创建失败', 'danger')
  }
}

async function viewAgentDetail(id) {
  try {
    const data = await API.get(`/agents/${id}`)
    const agent = data.data
    
    const levelNames = { 1: '股东', 2: '总代', 3: '代理' }
    const domainStatusText = { 0: '未验证', 1: '已验证', 2: '验证失败' }
    const domainStatusClass = { 0: 'warning', 1: 'success', 2: 'danger' }
    
    const content = `
      <div class="grid grid-2 gap-lg mb-6">
        <div>
          <h4 class="font-semibold mb-3">基本信息</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">代理ID</span><span class="font-mono">${agent.id}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">账号</span><span class="font-semibold">${escapeHtml(agent.username)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">级别</span><span class="badge badge-info">${levelNames[agent.agent_level] || '代理'}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">上级代理</span><span>${agent.parent?.username || '无(顶级)'}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">代理路径</span><span class="font-mono text-sm">${agent.agent_path || '/'}</span></div>
          </div>
        </div>
        <div>
          <h4 class="font-semibold mb-3">业务数据</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">账户余额</span><span class="text-emerald-600 font-semibold">${formatCurrency(agent.balance)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">占成比例</span><span>${agent.profit_share}%</span></div>
            <div class="flex justify-between"><span class="text-gray-500">洗码率</span><span>${(agent.commission_rate * 100).toFixed(2)}%</span></div>
            <div class="flex justify-between"><span class="text-gray-500">下级代理</span><span>${agent.stats?.sub_agents || 0}人</span></div>
            <div class="flex justify-between"><span class="text-gray-500">旗下玩家</span><span>${agent.stats?.total_players || 0}人</span></div>
          </div>
        </div>
      </div>
      
      <div class="bg-slate-700/50 rounded-lg p-4 mb-4">
        <h4 class="font-semibold mb-3"><i class="fas fa-share-alt mr-2 text-blue-400"></i>分享与域名</h4>
        <div class="space-y-sm">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">分享码</span>
            <span class="font-mono bg-slate-600 px-2 py-1 rounded">${agent.share_code || '未生成'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">专属域名</span>
            <span>
              ${agent.custom_domain ? 
                `<span class="font-mono">${escapeHtml(agent.custom_domain)}</span>
                 <span class="badge badge-${domainStatusClass[agent.domain_status || 0]} ml-2">${domainStatusText[agent.domain_status || 0]}</span>` 
                : '<span class="text-gray-400">未绑定</span>'}
            </span>
          </div>
        </div>
      </div>
      
      ${agent.subAgents && agent.subAgents.length > 0 ? `
        <div class="mb-4">
          <h4 class="font-semibold mb-2">下级代理</h4>
          <div class="flex flex-wrap gap-2">
            ${agent.subAgents.map(s => `<span class="badge badge-secondary">${escapeHtml(s.username)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <div class="flex gap-2">
        <button onclick="editAgent(${agent.id})" class="btn btn-primary btn-sm"><i class="fas fa-edit mr-1"></i>编辑</button>
        <button onclick="showAgentShareLink(${agent.id})" class="btn btn-info btn-sm"><i class="fas fa-share-alt mr-1"></i>分享链接</button>
        <button onclick="closeAllModals()" class="btn btn-secondary btn-sm">关闭</button>
      </div>
    `
    showModal(`代理详情 - ${escapeHtml(agent.username)}`, content, { width: '650px' })
  } catch (error) {
    showNotification('获取代理详情失败', 'danger')
  }
}

async function editAgent(id) {
  try {
    const data = await API.get(`/agents/${id}`)
    const agent = data.data
    const levelNames = { 1: '股东', 2: '总代', 3: '代理' }
    const domainStatusText = { 0: '未验证', 1: '已验证', 2: '验证失败' }
    const domainStatusClass = { 0: 'warning', 1: 'success', 2: 'danger' }
    
    const content = `
      <form onsubmit="submitEditAgent(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">代理账号</label>
            <input type="text" class="form-input" value="${escapeHtml(agent.username)}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">级别</label>
            <input type="text" class="form-input" value="${levelNames[agent.agent_level] || '代理'}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select id="editAgentStatus" class="form-select">
              <option value="1" ${agent.status === 1 ? 'selected' : ''}>正常</option>
              <option value="0" ${agent.status === 0 ? 'selected' : ''}>停用</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">占成比例(%)</label>
            <input type="number" id="editAgentProfitShare" class="form-input" step="0.01" min="0" max="100" value="${agent.profit_share || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">洗码率(%)</label>
            <input type="number" id="editAgentCommissionRate" class="form-input" step="0.01" min="0" max="5" value="${((agent.commission_rate || 0) * 100).toFixed(2)}">
          </div>
          <div class="form-group">
            <label class="form-label">分享码</label>
            <div class="flex gap-2">
              <input type="text" class="form-input flex-1" value="${agent.share_code || '未生成'}" disabled>
              <button type="button" onclick="regenerateShareCode(${id})" class="btn btn-secondary btn-sm" title="重新生成">
                <i class="fas fa-sync-alt"></i>
              </button>
            </div>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">
              <i class="fas fa-globe mr-1"></i>专属域名
              ${agent.custom_domain ? `<span class="badge badge-${domainStatusClass[agent.domain_status || 0]} ml-2">${domainStatusText[agent.domain_status || 0]}</span>` : ''}
            </label>
            <input type="text" id="editAgentCustomDomain" class="form-input" placeholder="例如: agent.example.com" value="${escapeHtml(agent.custom_domain || '')}">
            <p class="text-gray-400 text-xs mt-1">绑定专属域名后，用户可通过该域名访问注册页面自动关联到此代理</p>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="showAgentShareLink(${id})" class="btn btn-info flex-1">
            <i class="fas fa-share-alt mr-1"></i>分享链接
          </button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    closeAllModals()
    showModal(`编辑股东/代理 - ${escapeHtml(agent.username)}`, content, { width: '600px' })
  } catch (error) {
    showNotification('获取代理信息失败', 'danger')
  }
}

async function submitEditAgent(e, id) {
  e.preventDefault()
  try {
    const customDomain = document.getElementById('editAgentCustomDomain').value.trim()
    await API.put(`/agents/${id}`, {
      profit_share: parseFloat(document.getElementById('editAgentProfitShare').value),
      commission_rate: parseFloat(document.getElementById('editAgentCommissionRate').value) / 100,
      status: parseInt(document.getElementById('editAgentStatus').value),
      custom_domain: customDomain || ''
    })
    showNotification('代理信息更新成功', 'success')
    closeAllModals()
    loadModule('agents')
  } catch (error) {
    showNotification(error.response?.data?.error || '更新失败', 'danger')
  }
}

// 重新生成分享码
async function regenerateShareCode(id) {
  if (!confirm('确定要重新生成分享码吗？旧的分享链接将失效。')) return
  try {
    const result = await API.post(`/agents/${id}/regenerate-share-code`)
    showNotification(`分享码已更新: ${result.share_code}`, 'success')
    editAgent(id) // 刷新编辑弹窗
  } catch (error) {
    showNotification('生成失败', 'danger')
  }
}

// 显示代理分享链接弹窗
async function showAgentShareLink(id) {
  try {
    const result = await API.get(`/agents/${id}/share-info`)
    const data = result.data
    const baseUrl = window.location.origin
    const shareLink = `${baseUrl}/register?ref=${data.share_code}`
    const domainLink = data.custom_domain ? `https://${data.custom_domain}/register` : null
    
    const content = `
      <div class="space-y-md">
        <div class="bg-slate-700/50 rounded-lg p-4">
          <h4 class="font-semibold mb-3"><i class="fas fa-link mr-2 text-blue-400"></i>注册绑定分享链接</h4>
          <div class="flex gap-2 mb-2">
            <input type="text" class="form-input flex-1 font-mono text-sm" value="${shareLink}" readonly id="shareLinkInput">
            <button onclick="copyToClipboard('shareLinkInput')" class="btn btn-primary btn-sm">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <p class="text-gray-400 text-xs">用户通过此链接注册将自动绑定到代理 <strong>${escapeHtml(data.username)}</strong></p>
        </div>
        
        ${domainLink ? `
        <div class="bg-slate-700/50 rounded-lg p-4">
          <h4 class="font-semibold mb-3"><i class="fas fa-globe mr-2 text-emerald-400"></i>专属域名链接</h4>
          <div class="flex gap-2 mb-2">
            <input type="text" class="form-input flex-1 font-mono text-sm" value="${domainLink}" readonly id="domainLinkInput">
            <button onclick="copyToClipboard('domainLinkInput')" class="btn btn-success btn-sm">
              <i class="fas fa-copy"></i>
            </button>
          </div>
          <p class="text-gray-400 text-xs">专属域名注册链接，用户直接访问即可关联</p>
        </div>
        ` : `
        <div class="bg-slate-700/30 rounded-lg p-4 text-center text-gray-400">
          <i class="fas fa-globe text-2xl mb-2 opacity-50"></i>
          <p class="text-sm">暂未绑定专属域名</p>
          <button onclick="editAgent(${id})" class="btn btn-secondary btn-sm mt-2">去绑定</button>
        </div>
        `}
        
        <div class="bg-slate-700/50 rounded-lg p-4">
          <h4 class="font-semibold mb-3"><i class="fas fa-chart-bar mr-2 text-amber-400"></i>注册统计</h4>
          <div class="grid grid-3 gap-md text-center">
            <div>
              <div class="text-2xl font-bold text-emerald-400">${data.stats.total_registrations || 0}</div>
              <div class="text-gray-400 text-sm">总注册</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-blue-400">${data.stats.week_registrations || 0}</div>
              <div class="text-gray-400 text-sm">近7天</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-amber-400">${data.stats.today_registrations || 0}</div>
              <div class="text-gray-400 text-sm">今日</div>
            </div>
          </div>
        </div>
        
        <div class="flex justify-center">
          <button onclick="closeAllModals()" class="btn btn-secondary">关闭</button>
        </div>
      </div>
    `
    closeAllModals()
    showModal(`分享链接 - ${escapeHtml(data.username)}`, content, { width: '550px' })
  } catch (error) {
    showNotification('获取分享信息失败', 'danger')
  }
}

// 复制到剪贴板
function copyToClipboard(inputId) {
  const input = document.getElementById(inputId)
  input.select()
  document.execCommand('copy')
  showNotification('已复制到剪贴板', 'success')
}

// ============================================
// 通用查询表单组件
// ============================================

/**
 * 生成查询表单HTML
 * @param {Object} config - 配置对象
 * @param {string} config.formId - 表单ID
 * @param {Array} config.fields - 字段配置数组
 * @param {Function} config.onSearch - 搜索回调函数
 * @param {Function} config.onReset - 重置回调函数
 * @returns {string} HTML字符串
 */
function createSearchForm(config) {
  const { formId, fields, onSearch, onReset } = config
  
  const fieldHtml = fields.map(field => {
    switch (field.type) {
      case 'text':
        return `
          <div class="form-group">
            <label class="form-label">${field.label}</label>
            <input type="text" id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>
          </div>
        `
      case 'number':
        return `
          <div class="form-group">
            <label class="form-label">${field.label}</label>
            <input type="number" id="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''}>
          </div>
        `
      case 'date':
        return `
          <div class="form-group">
            <label class="form-label">${field.label}</label>
            <input type="date" id="${field.id}" class="form-input">
          </div>
        `
      case 'daterange':
        return `
          <div class="form-group col-span-2">
            <label class="form-label">${field.label}</label>
            <div class="grid grid-2 gap-2">
              <input type="date" id="${field.fromId}" class="form-input" placeholder="开始日期">
              <input type="date" id="${field.toId}" class="form-input" placeholder="结束日期">
            </div>
          </div>
        `
      case 'select':
        return `
          <div class="form-group">
            <label class="form-label">${field.label}</label>
            <select id="${field.id}" class="form-select">
              <option value="">全部</option>
              ${field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
          </div>
        `
      case 'amountrange':
        return `
          <div class="form-group col-span-2">
            <label class="form-label">${field.label}</label>
            <div class="grid grid-2 gap-2">
              <input type="number" id="${field.minId}" class="form-input" placeholder="最小金额" min="0" step="0.01">
              <input type="number" id="${field.maxId}" class="form-input" placeholder="最大金额" min="0" step="0.01">
            </div>
          </div>
        `
      default:
        return ''
    }
  }).join('')
  
  return `
    <div class="card mb-4">
      <div class="card-body">
        <form id="${formId}" class="search-form">
          <div class="grid grid-4 gap-md">
            ${fieldHtml}
          </div>
          <div class="flex gap-2 mt-4">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-search mr-1"></i>查询
            </button>
            <button type="button" onclick="${onReset}" class="btn btn-secondary">
              <i class="fas fa-redo mr-1"></i>重置
            </button>
          </div>
        </form>
      </div>
    </div>
  `
}

/**
 * 从表单获取查询参数
 * @param {Array} fields - 字段配置
 * @returns {Object} 查询参数对象
 */
function getSearchParams(fields) {
  const params = {}
  fields.forEach(field => {
    if (field.type === 'daterange') {
      const fromValue = document.getElementById(field.fromId)?.value
      const toValue = document.getElementById(field.toId)?.value
      if (fromValue) params[field.fromParam || 'date_from'] = fromValue
      if (toValue) params[field.toParam || 'date_to'] = toValue
    } else if (field.type === 'amountrange') {
      const minValue = document.getElementById(field.minId)?.value
      const maxValue = document.getElementById(field.maxId)?.value
      if (minValue) params[field.minParam || 'min_amount'] = minValue
      if (maxValue) params[field.maxParam || 'max_amount'] = maxValue
    } else {
      const value = document.getElementById(field.id)?.value
      if (value) params[field.param || field.id] = value
    }
  })
  return params
}

/**
 * 重置表单
 * @param {string} formId - 表单ID
 */
function resetSearchForm(formId) {
  document.getElementById(formId)?.reset()
}

// ============================================
// 完整功能实现 - 注单管理
// ============================================

async function viewBetDetail(id) {
  try {
    const data = await API.get(`/bets/${id}`)
    const bet = data.data
    
    const content = `
      <div class="grid grid-2 gap-lg mb-4">
        <div>
          <h4 class="font-semibold mb-3">注单信息</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">注单号</span><span class="font-mono">${escapeHtml(bet.bet_no)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">玩家</span><span>${escapeHtml(bet.username || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">游戏类型</span><span>${getGameTypeName(bet.game_type)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">桌台</span><span>${escapeHtml(bet.table_name || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">局号</span><span class="font-mono">${escapeHtml(bet.game_round || '-')}</span></div>
          </div>
        </div>
        <div>
          <h4 class="font-semibold mb-3">金额详情</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">投注额</span><span>${formatCurrency(bet.bet_amount)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">有效投注</span><span>${formatCurrency(bet.valid_bet)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">派彩</span><span>${formatCurrency(bet.payout_amount)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">盈亏</span><span class="${bet.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'} font-semibold">${bet.profit_loss >= 0 ? '+' : ''}${formatCurrency(bet.profit_loss)}</span></div>
          </div>
        </div>
      </div>
      <div class="bg-gray-50 rounded-lg p-3 mb-4">
        <div class="flex justify-between items-center">
          <span>投注内容</span>
          <span class="font-mono">${escapeHtml(bet.bet_content || '-')}</span>
        </div>
        <div class="flex justify-between items-center mt-2">
          <span>开奖结果</span>
          <span class="font-semibold">${escapeHtml(bet.game_result || '-')}</span>
        </div>
      </div>
      <div class="flex justify-between text-sm text-gray-500 mb-4">
        <span>投注时间: ${formatDate(bet.bet_at)}</span>
        <span>状态: ${getStatusBadge(bet.status, 'bet')}</span>
      </div>
      ${bet.status !== 2 ? `
        <div class="flex gap-2">
          <button onclick="voidBet(${bet.id})" class="btn btn-danger btn-sm"><i class="fas fa-trash mr-1"></i>作废注单</button>
          <button onclick="closeAllModals()" class="btn btn-secondary btn-sm">关闭</button>
        </div>
      ` : ''}
    `
    showModal('注单详情', content, { width: '600px' })
  } catch (error) {
    showNotification('获取注单详情失败', 'danger')
  }
}

// 渲染注单表格
function renderBetsTable(bets) {
  if (!bets || bets.length === 0) {
    return `<tr><td colspan="13">${showEmpty('list-alt', '暂无注单数据')}</td></tr>`
  }
  return bets.map(bet => `
    <tr class="${bet.bet_amount >= 50000 ? 'row-danger' : ''}">
      <td class="font-mono text-xs text-gray-500">${escapeHtml(bet.bet_no)}</td>
      <td class="font-semibold">${escapeHtml(bet.username || '-')}</td>
      <td class="text-gray-600 text-sm">${escapeHtml(bet.agent_name || '-')}</td>
      <td class="text-gray-600">${escapeHtml(bet.table_name || '-')}</td>
      <td class="text-center"><span class="badge badge-purple">${getGameTypeName(bet.game_type)}</span></td>
      <td class="text-center font-medium">${escapeHtml(bet.bet_type || '-')}</td>
      <td class="text-right font-mono text-blue-600">${formatCurrency(bet.bet_amount)}</td>
      <td class="text-right font-mono text-indigo-600">${formatCurrency(bet.valid_bet || bet.bet_amount)}</td>
      <td class="text-right font-mono text-gray-600">${formatCurrency(bet.payout_amount)}</td>
      <td class="text-right font-mono font-semibold ${bet.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}">
        ${bet.profit_loss >= 0 ? '+' : ''}${formatCurrency(bet.profit_loss)}
      </td>
      <td class="text-center">${getStatusBadge(bet.status, 'bet')}</td>
      <td class="text-xs text-gray-500">${formatShortDate(bet.bet_at)}</td>
      <td class="text-center">
        <div class="flex items-center justify-center gap-1">
          <button onclick="viewBetDetail(${bet.id})" class="btn btn-primary btn-xs">详情</button>
          ${bet.status !== 2 ? `<button onclick="voidBet(${bet.id})" class="btn btn-danger btn-xs">作废</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('')
}

// 搜索注单
async function searchBets() {
  const betNo = document.getElementById('betNoSearch')?.value || ''
  const username = document.getElementById('betUsernameSearch')?.value || ''
  const gameType = document.getElementById('gameTypeFilter')?.value || ''
  const status = document.getElementById('betStatusFilter')?.value
  const dateFrom = document.getElementById('betDateFrom')?.value || ''
  const dateTo = document.getElementById('betDateTo')?.value || ''
  const minAmount = document.getElementById('betMinAmount')?.value || ''
  const maxAmount = document.getElementById('betMaxAmount')?.value || ''
  const pageSize = document.getElementById('betsPageSize')?.value || 100
  
  try {
    const params = { limit: pageSize }
    if (betNo) params.bet_no = betNo
    if (username) params.username = username
    if (gameType) params.game_type = gameType
    if (status !== undefined && status !== '') params.status = status
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (minAmount) params.min_amount = minAmount
    if (maxAmount) params.max_amount = maxAmount
    
    const data = await API.get('/bets', params)
    
    // 更新表格
    document.getElementById('betsTableBody').innerHTML = renderBetsTable(data.data)
    document.getElementById('betsTotalCount').textContent = data.data.length
    
    // 更新统计
    const statsHtml = `
      <div class="text-center p-3 bg-blue-50 rounded-lg">
        <div class="text-2xl font-bold text-blue-600">${data.stats?.count || 0}</div>
        <div class="text-xs text-gray-500">总注单数</div>
      </div>
      <div class="text-center p-3 bg-indigo-50 rounded-lg">
        <div class="text-2xl font-bold text-indigo-600">${formatCurrency(data.stats?.total_bet || 0)}</div>
        <div class="text-xs text-gray-500">总投注额</div>
      </div>
      <div class="text-center p-3 bg-purple-50 rounded-lg">
        <div class="text-2xl font-bold text-purple-600">${formatCurrency(data.stats?.total_valid_bet || data.stats?.total_bet || 0)}</div>
        <div class="text-xs text-gray-500">有效投注</div>
      </div>
      <div class="text-center p-3 ${(data.stats?.total_profit || 0) >= 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-lg">
        <div class="text-2xl font-bold ${(data.stats?.total_profit || 0) >= 0 ? 'text-red-600' : 'text-emerald-600'}">${formatCurrency(Math.abs(data.stats?.total_profit || 0))}</div>
        <div class="text-xs text-gray-500">公司${(data.stats?.total_profit || 0) >= 0 ? '盈利' : '亏损'}</div>
      </div>
    `
    document.getElementById('betsStatsCards').innerHTML = statsHtml
    
    showNotification('查询完成', 'success')
  } catch (error) {
    showNotification('查询失败: ' + error.message, 'danger')
  }
}

// 重置注单筛选
function resetBetsFilter() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  document.getElementById('betNoSearch').value = ''
  document.getElementById('betUsernameSearch').value = ''
  document.getElementById('gameTypeFilter').value = ''
  document.getElementById('betStatusFilter').value = ''
  document.getElementById('betDateFrom').value = weekAgo
  document.getElementById('betDateTo').value = today
  document.getElementById('betMinAmount').value = ''
  document.getElementById('betMaxAmount').value = ''
  document.getElementById('betAgentSearch').value = ''
  
  searchBets()
}

// 导出注单报表
async function exportBets() {
  const betNo = document.getElementById('betNoSearch')?.value || ''
  const gameType = document.getElementById('gameTypeFilter')?.value || ''
  const status = document.getElementById('betStatusFilter')?.value
  const dateFrom = document.getElementById('betDateFrom')?.value || ''
  const dateTo = document.getElementById('betDateTo')?.value || ''
  
  try {
    showNotification('正在导出报表...', 'info')
    
    const params = {}
    if (gameType) params.game_type = gameType
    if (status !== undefined && status !== '') params.status = status
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    
    const result = await API.get('/exports/bets', params)
    
    if (!result.data || result.data.length === 0) {
      showNotification('没有可导出的数据', 'warning')
      return
    }
    
    // 生成CSV
    const headers = Object.keys(result.data[0])
    const csvContent = [
      headers.join(','),
      ...result.data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `注单报表_${dateFrom || 'all'}_${dateTo || 'all'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showNotification(`成功导出 ${result.data.length} 条记录`, 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// ============================================
// 完整功能实现 - 红利与洗码 (6个标签页)
// ============================================

// 切换红利与洗码标签页
function switchCommissionTab(tab) {
  const tabs = document.querySelectorAll('.tabs .tab')
  tabs.forEach((t, i) => {
    t.classList.remove('active')
    const tabNames = ['schemes', 'pending', 'bonus', 'activities', 'turnover', 'turnover-config']
    if (tabNames[i] === tab) t.classList.add('active')
  })
  
  switch(tab) {
    case 'schemes': loadCommissionSchemes(); break
    case 'pending': loadCommissionPending(); break
    case 'bonus': loadBonusDispatch(); break
    case 'activities': loadBonusActivities(); break
    case 'turnover': loadTurnoverAudit(); break
    case 'turnover-config': loadTurnoverConfigs(); break
  }
}

// 1. 洗码方案
async function loadCommissionSchemes() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/commission/schemes')
    const schemes = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${schemes.length} 个洗码方案</span>
        <button onclick="showAddSchemeModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增方案
        </button>
      </div>
      
      <div class="grid grid-3 gap-lg">
        ${schemes.map(scheme => `
          <div class="info-card">
            <div class="info-card-header">
              <div class="info-card-title">${escapeHtml(scheme.scheme_name)}</div>
              <div class="flex items-center gap-2">
                <span class="badge ${scheme.auto_settle ? 'badge-success' : 'badge-warning'}">
                  ${scheme.auto_settle ? '自动' : '人工'}
                </span>
                <span class="badge badge-info">${scheme.bound_count || 0}人</span>
              </div>
            </div>
            <div class="info-card-body">${escapeHtml(scheme.description) || '暂无描述'}</div>
            <div class="info-card-footer">
              <div class="info-card-row">
                <span class="info-card-row-label">结算周期</span>
                <span class="info-card-row-value">${scheme.settle_type === 1 ? '日结' : scheme.settle_type === 2 ? '周结' : '月结'}</span>
              </div>
              <div class="info-card-row">
                <span class="info-card-row-label">最低门槛</span>
                <span class="info-card-row-value">${formatCurrency(scheme.min_valid_bet)}</span>
              </div>
            </div>
            ${(scheme.rates || []).length > 0 ? `
              <div class="mt-4 pt-4 border-t">
                <div class="text-xs text-gray-500 mb-2">游戏费率</div>
                <div class="grid grid-2 gap-sm">
                  ${(scheme.rates || []).slice(0, 4).map(rate => `
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600">${getGameTypeName(rate.game_type)}</span>
                      <span class="font-mono font-semibold text-indigo-600">${(rate.commission_rate * 100).toFixed(2)}%</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            <div class="mt-4 pt-4 border-t flex gap-2">
              <button onclick="editScheme(${scheme.id})" class="btn btn-primary btn-xs flex-1">编辑</button>
              <button onclick="bindPlayersToScheme(${scheme.id})" class="btn btn-secondary btn-xs flex-1">绑定玩家</button>
            </div>
          </div>
        `).join('')}
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 2. 待审核洗码
async function loadCommissionPending() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/commission/pending')
    const pending = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${pending.length} 条待审核洗码</span>
        <div class="flex gap-2">
          <button onclick="batchApproveCommission()" class="btn btn-success btn-sm">
            <i class="fas fa-check-double mr-1"></i>批量通过
          </button>
          <button onclick="generateCommission()" class="btn btn-primary btn-sm">
            <i class="fas fa-calculator mr-1"></i>手动生成
          </button>
        </div>
      </div>
      
      ${pending.length === 0 ? showEmpty('check-circle', '暂无待审核洗码', '所有洗码申请已处理完成') : `
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" id="selectAllCommission" onchange="toggleSelectAllCommission()"></th>
                <th>会员账号</th>
                <th>方案</th>
                <th class="text-center">结算周期</th>
                <th class="text-right">有效投注</th>
                <th class="text-right">费率</th>
                <th class="text-right">返水金额</th>
                <th class="text-center">状态</th>
                <th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              ${pending.map(c => `
                <tr>
                  <td><input type="checkbox" class="commission-checkbox" value="${c.id}"></td>
                  <td class="font-semibold">${escapeHtml(c.username)}</td>
                  <td class="text-gray-600">${escapeHtml(c.scheme_name)}</td>
                  <td class="text-center text-xs text-gray-500">${formatDateOnly(c.period_start)} ~ ${formatDateOnly(c.period_end)}</td>
                  <td class="text-right font-mono">${formatCurrency(c.valid_bet)}</td>
                  <td class="text-right font-mono text-indigo-600">${(c.commission_rate * 100).toFixed(2)}%</td>
                  <td class="text-right font-mono font-semibold text-emerald-600">${formatCurrency(c.commission_amount)}</td>
                  <td class="text-center">${getStatusBadge(c.status, 'commission')}</td>
                  <td class="text-center">
                    <div class="flex items-center justify-center gap-2">
                      <button onclick="reviewCommission(${c.id}, 'approve')" class="btn btn-success btn-xs">通过</button>
                      <button onclick="reviewCommission(${c.id}, 'reject')" class="btn btn-danger btn-xs">拒绝</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 3. 红利派发
async function loadBonusDispatch() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/bonus/records', { limit: 50 })
    const records = result.data || []
    const stats = result.stats || {}
    
    container.innerHTML = `
      <!-- 统计卡片 -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-blue-600">${formatCurrency(stats.total_amount || 0)}</div>
          <div class="text-sm text-gray-500">总派发金额</div>
        </div>
        <div class="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-emerald-600">${stats.total_count || 0}</div>
          <div class="text-sm text-gray-500">派发次数</div>
        </div>
        <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-amber-600">${stats.pending_count || 0}</div>
          <div class="text-sm text-gray-500">待审核</div>
        </div>
        <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-600">${stats.today_amount || 0}</div>
          <div class="text-sm text-gray-500">今日派发</div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex gap-4">
          <select id="bonusType" class="form-select form-select-sm" style="width:150px;">
            <option value="">全部类型</option>
            <option value="signup">注册红利</option>
            <option value="deposit">存款红利</option>
            <option value="birthday">生日红利</option>
            <option value="vip">VIP红利</option>
            <option value="activity">活动红利</option>
            <option value="manual">人工派发</option>
          </select>
          <input type="date" id="bonusDateFrom" class="form-input form-input-sm" style="width:150px;">
          <input type="date" id="bonusDateTo" class="form-input form-input-sm" style="width:150px;">
          <button onclick="searchBonusRecords()" class="btn btn-primary btn-sm">查询</button>
        </div>
        <button onclick="showDispatchBonusModal()" class="btn btn-success btn-sm">
          <i class="fas fa-gift mr-1"></i>派发红利
        </button>
      </div>
      
      <!-- 红利记录表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>会员账号</th>
              <th>红利类型</th>
              <th class="text-right">红利金额</th>
              <th class="text-right">流水倍数</th>
              <th class="text-right">所需流水</th>
              <th class="text-right">已完成流水</th>
              <th class="text-center">状态</th>
              <th>派发时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="9">${showEmpty('gift', '暂无红利记录')}</td></tr>` :
              records.map(r => `
                <tr>
                  <td class="font-semibold">${escapeHtml(r.username || '-')}</td>
                  <td><span class="badge badge-purple">${getBonusTypeName(r.bonus_type)}</span></td>
                  <td class="text-right font-mono text-emerald-600">${formatCurrency(r.amount || 0)}</td>
                  <td class="text-right font-mono">${r.turnover_multiple || 1}x</td>
                  <td class="text-right font-mono">${formatCurrency(r.required_turnover || 0)}</td>
                  <td class="text-right font-mono ${(r.completed_turnover || 0) >= (r.required_turnover || 0) ? 'text-emerald-600' : 'text-amber-600'}">${formatCurrency(r.completed_turnover || 0)}</td>
                  <td class="text-center">
                    <span class="badge ${r.status === 1 ? 'badge-success' : r.status === 2 ? 'badge-info' : r.status === 3 ? 'badge-danger' : 'badge-warning'}">
                      ${r.status === 1 ? '已发放' : r.status === 2 ? '已完成' : r.status === 3 ? '已过期' : '待审核'}
                    </span>
                  </td>
                  <td class="text-sm text-gray-500">${formatShortDate(r.created_at)}</td>
                  <td class="text-center">
                    <button onclick="viewBonusDetail(${r.id})" class="btn btn-primary btn-xs">详情</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 红利类型名称
function getBonusTypeName(type) {
  const types = {
    'signup': '注册红利',
    'deposit': '存款红利',
    'birthday': '生日红利',
    'vip': 'VIP红利',
    'activity': '活动红利',
    'manual': '人工派发'
  }
  return types[type] || type || '未知'
}

// 显示派发红利弹窗
function showDispatchBonusModal() {
  const content = `
    <form onsubmit="submitDispatchBonus(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group col-span-2">
          <label class="form-label">会员账号 *</label>
          <input type="text" id="bonusUsername" class="form-input" required placeholder="请输入会员账号">
        </div>
        <div class="form-group">
          <label class="form-label">红利类型 *</label>
          <select id="bonusTypeSelect" class="form-select" required>
            <option value="manual">人工派发</option>
            <option value="signup">注册红利</option>
            <option value="deposit">存款红利</option>
            <option value="birthday">生日红利</option>
            <option value="vip">VIP红利</option>
            <option value="activity">活动红利</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">红利金额 *</label>
          <input type="number" id="bonusAmount" class="form-input" required min="1" placeholder="0.00">
        </div>
        <div class="form-group">
          <label class="form-label">流水倍数</label>
          <input type="number" id="bonusTurnover" class="form-input" min="0" value="1" step="0.1">
        </div>
        <div class="form-group">
          <label class="form-label">有效期(天)</label>
          <input type="number" id="bonusExpireDays" class="form-input" min="1" value="7">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">备注</label>
          <textarea id="bonusRemark" class="form-input" rows="2" placeholder="派发原因说明..."></textarea>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">确认派发</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('派发红利', content, { width: '500px' })
}

async function submitDispatchBonus(e) {
  e.preventDefault()
  try {
    await API.post('/bonus/dispatch', {
      username: document.getElementById('bonusUsername').value,
      bonus_type: document.getElementById('bonusTypeSelect').value,
      amount: parseFloat(document.getElementById('bonusAmount').value),
      turnover_multiple: parseFloat(document.getElementById('bonusTurnover').value) || 1,
      expire_days: parseInt(document.getElementById('bonusExpireDays').value) || 7,
      remark: document.getElementById('bonusRemark').value
    })
    showNotification('红利派发成功', 'success')
    closeAllModals()
    loadBonusDispatch()
  } catch (error) {
    showNotification('派发失败: ' + error.message, 'danger')
  }
}

async function searchBonusRecords() {
  loadBonusDispatch() // 简化实现，实际应该带参数查询
}

async function viewBonusDetail(id) {
  showNotification('查看红利详情: ' + id, 'info')
}

// 4. 流水稽查
async function loadTurnoverAudit() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/turnover/audit', { limit: 50 })
    const records = result.data || []
    
    container.innerHTML = `
      <!-- 搜索区域 -->
      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <div class="grid grid-cols-5 gap-4">
          <div class="form-group mb-0">
            <label class="form-label text-xs">会员账号</label>
            <input type="text" id="auditUsername" class="form-input form-input-sm" placeholder="输入会员账号">
          </div>
          <div class="form-group mb-0">
            <label class="form-label text-xs">稽查类型</label>
            <select id="auditType" class="form-select form-select-sm">
              <option value="">全部类型</option>
              <option value="withdrawal">提款流水</option>
              <option value="bonus">红利流水</option>
              <option value="deposit">存款流水</option>
            </select>
          </div>
          <div class="form-group mb-0">
            <label class="form-label text-xs">开始日期</label>
            <input type="date" id="auditDateFrom" class="form-input form-input-sm">
          </div>
          <div class="form-group mb-0">
            <label class="form-label text-xs">结束日期</label>
            <input type="date" id="auditDateTo" class="form-input form-input-sm">
          </div>
          <div class="form-group mb-0 flex items-end gap-2">
            <button onclick="searchTurnoverAudit()" class="btn btn-primary btn-sm flex-1">查询</button>
            <button onclick="exportTurnoverAudit()" class="btn btn-secondary btn-sm">导出</button>
          </div>
        </div>
      </div>
      
      <!-- 稽查记录表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>会员账号</th>
              <th>稽查类型</th>
              <th class="text-right">关联金额</th>
              <th class="text-right">所需流水</th>
              <th class="text-right">已完成流水</th>
              <th class="text-center">完成率</th>
              <th class="text-center">状态</th>
              <th>创建时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="9">${showEmpty('search-dollar', '暂无稽查记录')}</td></tr>` :
              records.map(r => {
                const progress = r.required_turnover > 0 ? Math.min(100, (r.completed_turnover / r.required_turnover * 100)) : 100
                return `
                  <tr>
                    <td class="font-semibold">${escapeHtml(r.username || '-')}</td>
                    <td><span class="badge ${r.audit_type === 'withdrawal' ? 'badge-warning' : r.audit_type === 'bonus' ? 'badge-purple' : 'badge-info'}">${getAuditTypeName(r.audit_type)}</span></td>
                    <td class="text-right font-mono">${formatCurrency(r.related_amount || 0)}</td>
                    <td class="text-right font-mono">${formatCurrency(r.required_turnover || 0)}</td>
                    <td class="text-right font-mono ${progress >= 100 ? 'text-emerald-600' : 'text-amber-600'}">${formatCurrency(r.completed_turnover || 0)}</td>
                    <td class="text-center">
                      <div class="flex items-center gap-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-2">
                          <div class="h-2 rounded-full ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${progress}%"></div>
                        </div>
                        <span class="text-xs font-mono">${progress.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="badge ${r.status === 1 ? 'badge-success' : r.status === 2 ? 'badge-danger' : 'badge-warning'}">
                        ${r.status === 1 ? '已完成' : r.status === 2 ? '未完成' : '进行中'}
                      </span>
                    </td>
                    <td class="text-sm text-gray-500">${formatShortDate(r.created_at)}</td>
                    <td class="text-center">
                      <button onclick="viewTurnoverDetail(${r.id})" class="btn btn-primary btn-xs">详情</button>
                    </td>
                  </tr>
                `
              }).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function getAuditTypeName(type) {
  const types = {
    'withdrawal': '提款流水',
    'bonus': '红利流水',
    'deposit': '存款流水'
  }
  return types[type] || type || '未知'
}

async function searchTurnoverAudit() {
  loadTurnoverAudit()
}

async function exportTurnoverAudit() {
  showNotification('正在导出流水稽查报表...', 'info')
}

async function viewTurnoverDetail(id) {
  showNotification('查看流水详情: ' + id, 'info')
}

// 5. 流水稽查配置
async function loadTurnoverConfigs() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/turnover/configs')
    const configs = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${configs.length} 个流水配置</span>
        <button onclick="showAddTurnoverConfigModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增配置
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        ${configs.length === 0 ? `<div class="col-span-2">${showEmpty('sliders-h', '暂无流水配置')}</div>` :
          configs.map(config => {
            let gameContrib = {}
            try { gameContrib = JSON.parse(config.game_contribution || '{}') } catch(e) {}
            
            return `
            <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${config.is_default ? 'ring-2 ring-blue-400' : ''}">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h4 class="font-bold text-gray-800">
                    ${escapeHtml(config.config_name)}
                    ${config.is_default ? '<span class="badge badge-info badge-sm ml-2">默认</span>' : ''}
                  </h4>
                  <p class="text-sm text-gray-500">${escapeHtml(config.description || '无描述')}</p>
                </div>
                <span class="badge ${config.status === 1 ? 'badge-success' : 'badge-gray'}">
                  ${config.status === 1 ? '启用' : '禁用'}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                <div class="flex justify-between">
                  <span class="text-gray-500">类型:</span>
                  <span class="badge badge-purple">${getTurnoverTypeName(config.config_type)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">流水倍数:</span>
                  <span class="font-mono font-bold text-indigo-600">${config.turnover_multiple}x</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">有效天数:</span>
                  <span class="font-mono">${config.valid_days}天</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">最低单注:</span>
                  <span class="font-mono">${formatCurrency(config.min_bet_amount || 0)}</span>
                </div>
              </div>
              ${Object.keys(gameContrib).length > 0 ? `
                <div class="text-xs text-gray-500 mb-3">
                  <span class="font-semibold">游戏贡献比例:</span>
                  ${Object.entries(gameContrib).slice(0, 3).map(([game, percent]) => 
                    `<span class="ml-2">${getGameTypeName(game)}:${percent}%</span>`
                  ).join('')}
                  ${Object.keys(gameContrib).length > 3 ? '...' : ''}
                </div>
              ` : ''}
              <div class="flex gap-2 pt-3 border-t">
                <button onclick="editTurnoverConfig(${config.id})" class="btn btn-primary btn-xs flex-1">编辑</button>
                <button onclick="toggleTurnoverConfig(${config.id}, ${config.status === 1 ? 0 : 1})" 
                        class="btn ${config.status === 1 ? 'btn-warning' : 'btn-success'} btn-xs flex-1">
                  ${config.status === 1 ? '禁用' : '启用'}
                </button>
                ${!config.is_default ? `
                  <button onclick="setDefaultTurnoverConfig(${config.id})" class="btn btn-info btn-xs">设为默认</button>
                ` : ''}
              </div>
            </div>
          `}).join('')}
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function getTurnoverTypeName(type) {
  const types = { 'deposit': '存款流水', 'bonus': '红利流水', 'withdrawal': '提款流水' }
  return types[type] || type || '未知'
}

function showAddTurnoverConfigModal() {
  const content = `
    <form onsubmit="submitAddTurnoverConfig(event)">
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group col-span-2">
          <label class="form-label">配置名称 *</label>
          <input type="text" id="tcName" class="form-input" required placeholder="如: 红利3倍流水">
        </div>
        <div class="form-group">
          <label class="form-label">类型 *</label>
          <select id="tcType" class="form-select" required>
            <option value="deposit">存款流水</option>
            <option value="bonus" selected>红利流水</option>
            <option value="withdrawal">提款流水</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">流水倍数 *</label>
          <input type="number" id="tcMultiple" class="form-input" required min="0" step="0.1" value="3">
        </div>
        <div class="form-group">
          <label class="form-label">有效天数</label>
          <input type="number" id="tcValidDays" class="form-input" min="0" value="7">
        </div>
        <div class="form-group">
          <label class="form-label">最低单注</label>
          <input type="number" id="tcMinBet" class="form-input" min="0" value="0">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">描述</label>
          <textarea id="tcDesc" class="form-input" rows="2" placeholder="配置说明..."></textarea>
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">游戏贡献比例 (%)</label>
          <div class="grid grid-cols-3 gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm w-16">百家乐</span>
              <input type="number" id="tcGameBaccarat" class="form-input form-input-sm" value="100" min="0" max="100">
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm w-16">龙虎</span>
              <input type="number" id="tcGameDragonTiger" class="form-input form-input-sm" value="100" min="0" max="100">
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm w-16">骰宝</span>
              <input type="number" id="tcGameSicbo" class="form-input form-input-sm" value="50" min="0" max="100">
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm w-16">轮盘</span>
              <input type="number" id="tcGameRoulette" class="form-input form-input-sm" value="50" min="0" max="100">
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm w-16">牛牛</span>
              <input type="number" id="tcGameBull" class="form-input form-input-sm" value="80" min="0" max="100">
            </div>
          </div>
        </div>
        <div class="form-group col-span-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="tcIsDefault">
            <span>设为该类型默认配置</span>
          </label>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建配置</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增流水配置', content, { width: '550px' })
}

async function submitAddTurnoverConfig(e) {
  e.preventDefault()
  try {
    await API.post('/turnover/configs', {
      config_name: document.getElementById('tcName').value,
      config_type: document.getElementById('tcType').value,
      turnover_multiple: parseFloat(document.getElementById('tcMultiple').value),
      valid_days: parseInt(document.getElementById('tcValidDays').value) || 7,
      min_bet_amount: parseFloat(document.getElementById('tcMinBet').value) || 0,
      description: document.getElementById('tcDesc').value,
      is_default: document.getElementById('tcIsDefault').checked,
      game_contribution: {
        baccarat: parseInt(document.getElementById('tcGameBaccarat').value) || 100,
        dragon_tiger: parseInt(document.getElementById('tcGameDragonTiger').value) || 100,
        sicbo: parseInt(document.getElementById('tcGameSicbo').value) || 50,
        roulette: parseInt(document.getElementById('tcGameRoulette').value) || 50,
        bull: parseInt(document.getElementById('tcGameBull').value) || 80
      }
    })
    showNotification('流水配置创建成功', 'success')
    closeAllModals()
    loadTurnoverConfigs()
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

async function editTurnoverConfig(id) {
  try {
    const result = await API.get(`/turnover/configs/${id}`)
    const config = result.data
    if (!config) throw new Error('配置不存在')
    
    const gameContrib = config.game_contribution || {}
    
    const content = `
      <form onsubmit="submitEditTurnoverConfig(event, ${id})">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group col-span-2">
            <label class="form-label">配置名称 *</label>
            <input type="text" id="editTcName" class="form-input" value="${escapeHtml(config.config_name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">流水倍数 *</label>
            <input type="number" id="editTcMultiple" class="form-input" value="${config.turnover_multiple}" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label class="form-label">有效天数</label>
            <input type="number" id="editTcValidDays" class="form-input" value="${config.valid_days}" min="0">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">描述</label>
            <textarea id="editTcDesc" class="form-input" rows="2">${escapeHtml(config.description || '')}</textarea>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">游戏贡献比例 (%)</label>
            <div class="grid grid-cols-3 gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm w-16">百家乐</span>
                <input type="number" id="editTcGameBaccarat" class="form-input form-input-sm" value="${gameContrib.baccarat || 100}" min="0" max="100">
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm w-16">龙虎</span>
                <input type="number" id="editTcGameDragonTiger" class="form-input form-input-sm" value="${gameContrib.dragon_tiger || 100}" min="0" max="100">
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm w-16">骰宝</span>
                <input type="number" id="editTcGameSicbo" class="form-input form-input-sm" value="${gameContrib.sicbo || 50}" min="0" max="100">
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑流水配置', content, { width: '500px' })
  } catch (error) {
    showNotification('获取配置失败: ' + error.message, 'danger')
  }
}

async function submitEditTurnoverConfig(e, id) {
  e.preventDefault()
  try {
    await API.put(`/turnover/configs/${id}`, {
      config_name: document.getElementById('editTcName').value,
      turnover_multiple: parseFloat(document.getElementById('editTcMultiple').value),
      valid_days: parseInt(document.getElementById('editTcValidDays').value),
      description: document.getElementById('editTcDesc').value,
      game_contribution: {
        baccarat: parseInt(document.getElementById('editTcGameBaccarat').value) || 100,
        dragon_tiger: parseInt(document.getElementById('editTcGameDragonTiger').value) || 100,
        sicbo: parseInt(document.getElementById('editTcGameSicbo').value) || 50
      }
    })
    showNotification('流水配置更新成功', 'success')
    closeAllModals()
    loadTurnoverConfigs()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

async function toggleTurnoverConfig(id, newStatus) {
  try {
    await API.put(`/turnover/configs/${id}`, { status: newStatus })
    showNotification(newStatus ? '配置已启用' : '配置已禁用', 'success')
    loadTurnoverConfigs()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

async function setDefaultTurnoverConfig(id) {
  try {
    await API.put(`/turnover/configs/${id}`, { is_default: true })
    showNotification('已设为默认配置', 'success')
    loadTurnoverConfigs()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

// 6. 红利活动方案
async function loadBonusActivities() {
  const container = document.getElementById('commissionContent')
  container.innerHTML = showLoading()
  
  try {
    const [activitiesResult, configsResult] = await Promise.all([
      API.get('/bonus/activities'),
      API.get('/turnover/configs', { type: 'bonus' })
    ])
    const activities = activitiesResult.data || []
    const turnoverConfigs = configsResult.data || []
    
    // 存储全局供后续使用
    window._turnoverConfigs = turnoverConfigs
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${activities.length} 个红利活动</span>
        <button onclick="showAddBonusActivityModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增活动
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        ${activities.length === 0 ? `<div class="col-span-2">${showEmpty('calendar-star', '暂无红利活动')}</div>` :
          activities.map(activity => `
            <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h4 class="font-bold text-gray-800">${escapeHtml(activity.activity_name)}</h4>
                  <p class="text-sm text-gray-500">${escapeHtml(activity.description || '无描述')}</p>
                </div>
                <div class="flex items-center gap-2">
                  ${activity.auto_dispatch ? '<span class="badge badge-info badge-sm">自动派发</span>' : ''}
                  <span class="badge ${activity.status === 1 ? 'badge-success' : activity.status === 2 ? 'badge-gray' : 'badge-warning'}">
                    ${activity.status === 1 ? '进行中' : activity.status === 2 ? '已结束' : '已禁用'}
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                <div class="flex justify-between">
                  <span class="text-gray-500">活动类型:</span>
                  <span class="badge badge-purple">${getActivityTypeName(activity.activity_type)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">红利形式:</span>
                  <span class="badge badge-info">${getBonusFormName(activity.bonus_type)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">红利值:</span>
                  <span class="font-mono font-bold text-emerald-600">
                    ${activity.bonus_type === 'percent' ? activity.bonus_value + '%' : 
                      activity.bonus_type === 'fixed' ? formatCurrency(activity.bonus_value) : '阶梯'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">最高红利:</span>
                  <span class="font-mono">${activity.max_bonus ? formatCurrency(activity.max_bonus) : '无限制'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">流水配置:</span>
                  <span class="text-xs">${escapeHtml(activity.turnover_config_name || '未设置')}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">领取限制:</span>
                  <span class="font-mono">${activity.claim_limit === 0 ? '无限' : activity.claim_limit + '次'}</span>
                </div>
              </div>
              ${activity.start_time || activity.end_time ? `
                <div class="text-xs text-gray-400 mb-3">
                  <i class="fas fa-clock mr-1"></i>
                  ${activity.start_time ? formatShortDate(activity.start_time) : '无限'} ~ 
                  ${activity.end_time ? formatShortDate(activity.end_time) : '无限'}
                </div>
              ` : ''}
              <div class="flex gap-2 pt-3 border-t">
                <button onclick="editBonusActivity(${activity.id})" class="btn btn-primary btn-xs flex-1">编辑</button>
                <button onclick="toggleBonusActivity(${activity.id}, ${activity.status === 1 ? 0 : 1})" 
                        class="btn ${activity.status === 1 ? 'btn-warning' : 'btn-success'} btn-xs flex-1">
                  ${activity.status === 1 ? '禁用' : '启用'}
                </button>
                <button onclick="deleteBonusActivity(${activity.id})" class="btn btn-danger btn-xs">删除</button>
              </div>
            </div>
          `).join('')}
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function getActivityTypeName(type) {
  const types = {
    'signup': '注册红利',
    'first_deposit': '首存红利',
    'reload': '续存红利',
    'birthday': '生日红利',
    'vip': 'VIP红利',
    'daily': '每日红利',
    'weekly': '每周红利'
  }
  return types[type] || type || '未知'
}

function getBonusFormName(type) {
  const types = { 'fixed': '固定金额', 'percent': '百分比', 'tiered': '阶梯' }
  return types[type] || type || '未知'
}

async function showAddBonusActivityModal() {
  const turnoverConfigs = window._turnoverConfigs || []
  
  const content = `
    <form onsubmit="submitAddBonusActivity(event)">
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group col-span-2">
          <label class="form-label">活动名称 *</label>
          <input type="text" id="baName" class="form-input" required placeholder="如: 首存100%优惠">
        </div>
        <div class="form-group">
          <label class="form-label">活动类型 *</label>
          <select id="baActivityType" class="form-select" required>
            <option value="signup">注册红利</option>
            <option value="first_deposit">首存红利</option>
            <option value="reload">续存红利</option>
            <option value="birthday">生日红利</option>
            <option value="vip">VIP红利</option>
            <option value="daily">每日红利</option>
            <option value="weekly">每周红利</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">红利形式 *</label>
          <select id="baBonusType" class="form-select" required onchange="toggleBonusValueInput()">
            <option value="fixed">固定金额</option>
            <option value="percent">百分比</option>
            <option value="tiered">阶梯</option>
          </select>
        </div>
        <div class="form-group" id="bonusValueGroup">
          <label class="form-label">红利值</label>
          <input type="number" id="baBonusValue" class="form-input" min="0" step="0.01" placeholder="固定金额或百分比">
        </div>
        <div class="form-group">
          <label class="form-label">最高红利</label>
          <input type="number" id="baMaxBonus" class="form-input" min="0" placeholder="0表示无限制">
        </div>
        <div class="form-group">
          <label class="form-label">最低存款</label>
          <input type="number" id="baMinDeposit" class="form-input" min="0" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">流水稽查配置 *</label>
          <select id="baTurnoverConfig" class="form-select" required>
            <option value="">-- 选择流水配置 --</option>
            ${turnoverConfigs.map(tc => `
              <option value="${tc.id}">${escapeHtml(tc.config_name)} (${tc.turnover_multiple}x)</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">领取次数</label>
          <input type="number" id="baClaimLimit" class="form-input" min="0" value="1" placeholder="0表示无限">
        </div>
        <div class="form-group">
          <label class="form-label">领取间隔</label>
          <select id="baClaimInterval" class="form-select">
            <option value="once">仅一次</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">描述</label>
          <textarea id="baDesc" class="form-input" rows="2" placeholder="活动说明..."></textarea>
        </div>
        <div class="form-group">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="baAutoDispatch">
            <span>自动派发</span>
          </label>
        </div>
        <div class="form-group">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="baEnabled" checked>
            <span>立即启用</span>
          </label>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建活动</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增红利活动', content, { width: '600px' })
}

function toggleBonusValueInput() {
  const type = document.getElementById('baBonusType').value
  const group = document.getElementById('bonusValueGroup')
  group.style.display = type === 'tiered' ? 'none' : 'block'
}

async function submitAddBonusActivity(e) {
  e.preventDefault()
  try {
    await API.post('/bonus/activities', {
      activity_name: document.getElementById('baName').value,
      activity_type: document.getElementById('baActivityType').value,
      bonus_type: document.getElementById('baBonusType').value,
      bonus_value: parseFloat(document.getElementById('baBonusValue').value) || null,
      max_bonus: parseFloat(document.getElementById('baMaxBonus').value) || null,
      min_deposit: parseFloat(document.getElementById('baMinDeposit').value) || null,
      turnover_config_id: parseInt(document.getElementById('baTurnoverConfig').value) || null,
      claim_limit: parseInt(document.getElementById('baClaimLimit').value) || 1,
      claim_interval: document.getElementById('baClaimInterval').value,
      description: document.getElementById('baDesc').value,
      auto_dispatch: document.getElementById('baAutoDispatch').checked ? 1 : 0,
      status: document.getElementById('baEnabled').checked ? 1 : 0
    })
    showNotification('红利活动创建成功', 'success')
    closeAllModals()
    loadBonusActivities()
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

async function editBonusActivity(id) {
  try {
    const [activityResult, configsResult] = await Promise.all([
      API.get(`/bonus/activities/${id}`),
      API.get('/turnover/configs', { type: 'bonus' })
    ])
    const activity = activityResult.data
    const turnoverConfigs = configsResult.data || []
    
    if (!activity) throw new Error('活动不存在')
    
    const content = `
      <form onsubmit="submitEditBonusActivity(event, ${id})">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group col-span-2">
            <label class="form-label">活动名称 *</label>
            <input type="text" id="editBaName" class="form-input" value="${escapeHtml(activity.activity_name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">红利值</label>
            <input type="number" id="editBaBonusValue" class="form-input" value="${activity.bonus_value || ''}" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label">最高红利</label>
            <input type="number" id="editBaMaxBonus" class="form-input" value="${activity.max_bonus || ''}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">流水稽查配置</label>
            <select id="editBaTurnoverConfig" class="form-select">
              <option value="">-- 选择流水配置 --</option>
              ${turnoverConfigs.map(tc => `
                <option value="${tc.id}" ${activity.turnover_config_id === tc.id ? 'selected' : ''}>
                  ${escapeHtml(tc.config_name)} (${tc.turnover_multiple}x)
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="flex items-center gap-2 h-full">
              <input type="checkbox" id="editBaAutoDispatch" ${activity.auto_dispatch ? 'checked' : ''}>
              <span>自动派发</span>
            </label>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">描述</label>
            <textarea id="editBaDesc" class="form-input" rows="2">${escapeHtml(activity.description || '')}</textarea>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑红利活动', content, { width: '550px' })
  } catch (error) {
    showNotification('获取活动失败: ' + error.message, 'danger')
  }
}

async function submitEditBonusActivity(e, id) {
  e.preventDefault()
  try {
    await API.put(`/bonus/activities/${id}`, {
      activity_name: document.getElementById('editBaName').value,
      bonus_value: parseFloat(document.getElementById('editBaBonusValue').value) || null,
      max_bonus: parseFloat(document.getElementById('editBaMaxBonus').value) || null,
      turnover_config_id: parseInt(document.getElementById('editBaTurnoverConfig').value) || null,
      auto_dispatch: document.getElementById('editBaAutoDispatch').checked ? 1 : 0,
      description: document.getElementById('editBaDesc').value
    })
    showNotification('红利活动更新成功', 'success')
    closeAllModals()
    loadBonusActivities()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

async function toggleBonusActivity(id, newStatus) {
  try {
    await API.post(`/bonus/activities/${id}/toggle`, { status: newStatus })
    showNotification(newStatus === 1 ? '活动已启用' : '活动已禁用', 'success')
    loadBonusActivities()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

async function deleteBonusActivity(id) {
  if (!confirm('确定删除该红利活动吗？')) return
  try {
    await API.delete(`/bonus/activities/${id}`)
    showNotification('活动删除成功', 'success')
    loadBonusActivities()
  } catch (error) {
    showNotification('删除失败: ' + error.message, 'danger')
  }
}

// ============================================
// 完整功能实现 - 风险控端 (3个标签页)
// ============================================

// 切换风险控端标签页
function switchRiskTab(tab) {
  const tabs = document.querySelectorAll('.tabs .tab')
  tabs.forEach((t, i) => {
    t.classList.remove('active')
    const tabNames = ['alerts', 'limits', 'rules']
    if (tabNames[i] === tab) t.classList.add('active')
  })
  
  switch(tab) {
    case 'alerts': loadRiskAlerts(); break
    case 'limits': loadRiskLimits(); break
    case 'rules': loadRiskRules(); break
  }
}

// 1. 风险预警
async function loadRiskAlerts() {
  const container = document.getElementById('riskContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/risk/alerts', { status: 0 })
    const alerts = result.data || []
    
    const getRiskLevel = (count) => {
      if (count > 2) return { text: 'HIGH', class: 'text-red-600', bg: 'bg-red-100' }
      if (count > 0) return { text: 'MEDIUM', class: 'text-amber-600', bg: 'bg-amber-100' }
      return { text: 'LOW', class: 'text-emerald-600', bg: 'bg-emerald-100' }
    }
    const risk = getRiskLevel(alerts.length)
    
    container.innerHTML = `
      <!-- 风险指数 -->
      <div class="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <div class="text-sm text-gray-500">系统风险指数</div>
          <div class="text-3xl font-bold ${risk.class}">${risk.text}</div>
        </div>
        <div class="w-16 h-16 rounded-xl ${risk.bg} flex items-center justify-center">
          <i class="fas ${alerts.length > 0 ? 'fa-exclamation-triangle' : 'fa-shield-alt'} text-3xl ${risk.class}"></i>
        </div>
      </div>
      
      ${alerts.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon success">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div class="empty-state-title text-emerald-600">系统运行正常</div>
          <div class="empty-state-text">暂无风险预警</div>
        </div>
      ` : `
        <div class="space-y-md">
          ${alerts.map(alert => {
            let alertData = {}
            try { alertData = JSON.parse(alert.alert_data || '{}') } catch(e) {}
            
            const severityConfig = {
              low: { card: 'info', icon: 'info-circle' },
              medium: { card: 'warning', icon: 'exclamation-triangle' },
              high: { card: 'warning', icon: 'exclamation-triangle' },
              critical: { card: 'danger', icon: 'exclamation-circle' }
            }
            const sc = severityConfig[alert.severity] || severityConfig.medium
            
            const alertTypes = {
              'big_bet': '单注超限',
              'arb_suspect': '套利嫌疑',
              'high_win': '连赢预警',
              'ip_abnormal': 'IP异常'
            }
            
            return `
              <div class="alert-card ${sc.card}">
                <i class="fas fa-${sc.icon} alert-card-icon"></i>
                <div class="alert-card-content flex-1">
                  <div class="flex items-center flex-wrap gap-2 mb-2">
                    <span class="badge badge-danger">${alertTypes[alert.alert_type] || '风险预警'}</span>
                    <span class="badge badge-${alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'warning' : 'info'}">${(alert.severity || '').toUpperCase()}</span>
                    <span class="font-semibold">${escapeHtml(alert.username || '未知玩家')}</span>
                    ${alert.table_name ? `<span class="text-sm text-gray-500">${escapeHtml(alert.table_name)}</span>` : ''}
                  </div>
                  <div class="alert-card-text">${alertData.message || '检测到风险行为'}</div>
                  <div class="text-xs text-gray-400 mt-2">
                    <i class="fas fa-clock mr-1"></i>${formatDate(alert.created_at)}
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="handleRiskAlert(${alert.id}, 'lock')" class="btn btn-danger btn-sm">
                    <i class="fas fa-lock"></i> 锁定
                  </button>
                  <button onclick="handleRiskAlert(${alert.id}, 'observe')" class="btn btn-warning btn-sm">
                    <i class="fas fa-eye"></i> 观察
                  </button>
                  <button onclick="handleRiskAlert(${alert.id}, 'ignore')" class="btn btn-secondary btn-sm">
                    <i class="fas fa-times"></i> 忽略
                  </button>
                </div>
              </div>
            `
          }).join('')}
        </div>
      `}
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 2. 限红配置
async function loadRiskLimits() {
  const container = document.getElementById('riskContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/risk/limits')
    const limits = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${limits.length} 条限红配置</span>
        <button onclick="showAddLimitModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增限红
        </button>
      </div>
      
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>配置名称</th>
              <th>游戏类型</th>
              <th class="text-right">最低投注</th>
              <th class="text-right">最高投注</th>
              <th class="text-right">单注最高派彩</th>
              <th class="text-right">单日最高赢额</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${limits.length === 0 ? `<tr><td colspan="7">${showEmpty('sliders-h', '暂无限红配置')}</td></tr>` :
              limits.map(limit => `
                <tr>
                  <td class="font-semibold">${escapeHtml(limit.config_name)}</td>
                  <td><span class="badge badge-purple">${getGameTypeName(limit.game_type)}</span></td>
                  <td class="text-right font-mono">${formatCurrency(limit.min_bet)}</td>
                  <td class="text-right font-mono text-blue-600">${formatCurrency(limit.max_bet)}</td>
                  <td class="text-right font-mono">${limit.max_payout ? formatCurrency(limit.max_payout) : '-'}</td>
                  <td class="text-right font-mono text-amber-600">${limit.daily_max_win ? formatCurrency(limit.daily_max_win) : '-'}</td>
                  <td class="text-center">
                    <button onclick="editLimit(${limit.id})" class="btn btn-primary btn-xs">编辑</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 3. 风控规则
async function loadRiskRules() {
  const container = document.getElementById('riskContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/risk/rules')
    const rules = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm text-gray-500">共 ${rules.length} 条风控规则</span>
        <button onclick="showAddRiskRuleModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增规则
        </button>
      </div>
      
      <div class="grid grid-2 gap-4">
        ${rules.length === 0 ? `<div class="col-span-2">${showEmpty('cog', '暂无风控规则')}</div>` :
          rules.map(rule => {
            // 解析条件JSON
            let condition = {}
            try { condition = JSON.parse(rule.rule_condition || '{}') } catch(e) {}
            const conditionText = formatRuleCondition(rule.rule_type, condition)
            
            return `
            <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h4 class="font-bold text-gray-800">${escapeHtml(rule.rule_name)}</h4>
                  <p class="text-sm text-gray-500">${escapeHtml(rule.description || '无描述')}</p>
                </div>
                <span class="badge ${rule.is_enabled ? 'badge-success' : 'badge-gray'}">
                  ${rule.is_enabled ? '启用' : '禁用'}
                </span>
              </div>
              <div class="grid grid-2 gap-2 text-sm mb-3">
                <div class="flex justify-between">
                  <span class="text-gray-500">规则类型:</span>
                  <span class="badge badge-info">${getRuleTypeName(rule.rule_type)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">触发动作:</span>
                  <span class="badge badge-warning">${getRuleActionName(rule.action || rule.action_type)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">严重级别:</span>
                  <span class="badge ${getSeverityClass(rule.severity)}">${getSeverityName(rule.severity)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">触发条件:</span>
                  <span class="font-mono text-xs">${conditionText}</span>
                </div>
              </div>
              <div class="flex gap-2 pt-3 border-t">
                <button onclick="editRiskRule(${rule.id})" class="btn btn-primary btn-xs flex-1">编辑</button>
                <button onclick="toggleRiskRule(${rule.id}, ${rule.is_enabled ? 0 : 1})" class="btn ${rule.is_enabled ? 'btn-warning' : 'btn-success'} btn-xs flex-1">
                  ${rule.is_enabled ? '禁用' : '启用'}
                </button>
              </div>
            </div>
          `}).join('')}
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function getRuleTypeName(type) {
  const types = {
    'big_bet': '大额投注',
    'win_streak': '连赢检测',
    'loss_streak': '连亏检测',
    'consecutive_win': '连续获胜',
    'ip_multi': 'IP重复',
    'ip_multi_account': 'IP多账户',
    'device_multi': '设备重复',
    'arb_pattern': '套利模式',
    'arb_suspect': '对冲嫌疑',
    'frequency': '频率异常',
    'balance_jump': '余额异常'
  }
  return types[type] || type || '未知'
}

function getSeverityName(severity) {
  const names = { 'low': '低', 'medium': '中', 'high': '高', 'critical': '严重' }
  return names[severity] || severity || '中'
}

function getSeverityClass(severity) {
  const classes = { 
    'low': 'badge-gray', 
    'medium': 'badge-info', 
    'high': 'badge-warning', 
    'critical': 'badge-danger' 
  }
  return classes[severity] || 'badge-info'
}

function formatRuleCondition(ruleType, condition) {
  if (!condition || Object.keys(condition).length === 0) return '-'
  
  const parts = []
  if (condition.min_amount) parts.push(`≥${formatCurrency(condition.min_amount)}`)
  if (condition.daily_total) parts.push(`日累计≥${formatCurrency(condition.daily_total)}`)
  if (condition.min_accounts) parts.push(`≥${condition.min_accounts}账户`)
  if (condition.min_rounds) parts.push(`≥${condition.min_rounds}局`)
  if (condition.min_profit) parts.push(`盈利≥${formatCurrency(condition.min_profit)}`)
  if (condition.same_round) parts.push('同局')
  if (condition.opposite_bet) parts.push('对冲')
  
  return parts.length > 0 ? parts.join(', ') : JSON.stringify(condition).slice(0, 30)
}

function getRuleActionName(action) {
  const actions = {
    'alert': '发送预警',
    'freeze': '冻结账户',
    'limit': '限制投注',
    'notify': '通知管理员',
    'block': '封禁账户'
  }
  return actions[action] || action || '未知'
}

// 显示新增风控规则弹窗
function showAddRiskRuleModal() {
  const content = `
    <form onsubmit="submitAddRiskRule(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group col-span-2">
          <label class="form-label">规则名称 *</label>
          <input type="text" id="ruleName" class="form-input" required placeholder="如: 单注大额预警">
        </div>
        <div class="form-group">
          <label class="form-label">规则类型 *</label>
          <select id="ruleType" class="form-select" required onchange="updateRuleConditionFields()">
            <option value="big_bet">大额投注</option>
            <option value="consecutive_win">连续获胜</option>
            <option value="ip_multi_account">IP多账户</option>
            <option value="arb_suspect">对冲嫌疑</option>
            <option value="frequency">频率异常</option>
            <option value="balance_jump">余额异常</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">触发动作 *</label>
          <select id="ruleAction" class="form-select" required>
            <option value="alert">发送预警</option>
            <option value="observe">持续观察</option>
            <option value="lock">锁定账户</option>
            <option value="notify">通知管理员</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">严重级别 *</label>
          <select id="ruleSeverity" class="form-select" required>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high" selected>高</option>
            <option value="critical">严重</option>
          </select>
        </div>
        <div class="form-group" id="conditionFields">
          <label class="form-label">触发条件</label>
          <div id="conditionInputs">
            <input type="number" id="ruleMinAmount" class="form-input mb-2" min="0" placeholder="最小金额 (如: 50000)">
          </div>
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">描述</label>
          <textarea id="ruleDesc" class="form-input" rows="2" placeholder="规则说明..."></textarea>
        </div>
        <div class="form-group col-span-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="ruleEnabled" checked>
            <span>立即启用</span>
          </label>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建规则</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增风控规则', content, { width: '550px' })
}

// 更新条件输入字段
function updateRuleConditionFields() {
  const ruleType = document.getElementById('ruleType').value
  const container = document.getElementById('conditionInputs')
  
  let html = ''
  switch(ruleType) {
    case 'big_bet':
      html = `<input type="number" id="ruleMinAmount" class="form-input" min="0" placeholder="最小金额 (如: 50000)" value="50000">`
      break
    case 'consecutive_win':
      html = `
        <input type="number" id="ruleMinRounds" class="form-input mb-2" min="1" placeholder="连续局数 (如: 5)" value="5">
        <input type="number" id="ruleMinProfit" class="form-input" min="0" placeholder="最低盈利金额 (如: 10000)" value="10000">
      `
      break
    case 'ip_multi_account':
      html = `<input type="number" id="ruleMinAccounts" class="form-input" min="2" placeholder="最小账户数 (如: 3)" value="3">`
      break
    case 'arb_suspect':
      html = `
        <label class="flex items-center gap-2 mb-2">
          <input type="checkbox" id="ruleSameRound" checked>
          <span>检测同局投注</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" id="ruleOppositeBet" checked>
          <span>检测对冲投注</span>
        </label>
      `
      break
    default:
      html = `<input type="text" id="ruleConditionJson" class="form-input" placeholder='自定义条件JSON (如: {"key": "value"})'>`
  }
  container.innerHTML = html
}

// 获取条件JSON
function getRuleCondition() {
  const ruleType = document.getElementById('ruleType').value
  let condition = {}
  
  switch(ruleType) {
    case 'big_bet':
      condition = { min_amount: parseInt(document.getElementById('ruleMinAmount')?.value) || 50000 }
      break
    case 'consecutive_win':
      condition = { 
        min_rounds: parseInt(document.getElementById('ruleMinRounds')?.value) || 5,
        min_profit: parseInt(document.getElementById('ruleMinProfit')?.value) || 10000
      }
      break
    case 'ip_multi_account':
      condition = { min_accounts: parseInt(document.getElementById('ruleMinAccounts')?.value) || 3 }
      break
    case 'arb_suspect':
      condition = { 
        same_round: document.getElementById('ruleSameRound')?.checked ?? true,
        opposite_bet: document.getElementById('ruleOppositeBet')?.checked ?? true
      }
      break
    default:
      try {
        condition = JSON.parse(document.getElementById('ruleConditionJson')?.value || '{}')
      } catch(e) {
        condition = {}
      }
  }
  return JSON.stringify(condition)
}

async function submitAddRiskRule(e) {
  e.preventDefault()
  try {
    await API.post('/risk/rules', {
      rule_name: document.getElementById('ruleName').value,
      rule_type: document.getElementById('ruleType').value,
      action: document.getElementById('ruleAction').value,
      severity: document.getElementById('ruleSeverity').value,
      rule_condition: getRuleCondition(),
      description: document.getElementById('ruleDesc').value,
      is_enabled: document.getElementById('ruleEnabled').checked ? 1 : 0
    })
    showNotification('风控规则创建成功', 'success')
    closeAllModals()
    loadRiskRules()
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

async function editRiskRule(id) {
  try {
    const result = await API.get('/risk/rules')
    const rule = result.data.find(r => r.id === id)
    if (!rule) throw new Error('规则不存在')
    
    // 解析条件JSON
    let condition = {}
    try { condition = JSON.parse(rule.rule_condition || '{}') } catch(e) {}
    
    const ruleTypes = ['big_bet', 'consecutive_win', 'ip_multi_account', 'arb_suspect', 'frequency', 'balance_jump']
    const actions = ['alert', 'observe', 'lock', 'notify']
    const severities = ['low', 'medium', 'high', 'critical']
    
    const content = `
      <form onsubmit="submitEditRiskRule(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group col-span-2">
            <label class="form-label">规则名称 *</label>
            <input type="text" id="editRuleName" class="form-input" value="${escapeHtml(rule.rule_name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">规则类型</label>
            <select id="editRuleType" class="form-select">
              ${ruleTypes.map(t => 
                `<option value="${t}" ${rule.rule_type === t ? 'selected' : ''}>${getRuleTypeName(t)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">触发动作</label>
            <select id="editRuleAction" class="form-select">
              ${actions.map(a => 
                `<option value="${a}" ${(rule.action || rule.action_type) === a ? 'selected' : ''}>${getRuleActionName(a)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">严重级别</label>
            <select id="editRuleSeverity" class="form-select">
              ${severities.map(s => 
                `<option value="${s}" ${rule.severity === s ? 'selected' : ''}>${getSeverityName(s)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">触发条件 (JSON)</label>
            <input type="text" id="editRuleCondition" class="form-input font-mono text-sm" value='${escapeHtml(JSON.stringify(condition))}'>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">描述</label>
            <textarea id="editRuleDesc" class="form-input" rows="2">${escapeHtml(rule.description || '')}</textarea>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑风控规则', content, { width: '550px' })
  } catch (error) {
    showNotification('获取规则失败: ' + error.message, 'danger')
  }
}

async function submitEditRiskRule(e, id) {
  e.preventDefault()
  try {
    // 解析条件JSON
    let ruleCondition = '{}'
    try {
      const conditionInput = document.getElementById('editRuleCondition').value
      JSON.parse(conditionInput) // 验证JSON格式
      ruleCondition = conditionInput
    } catch(e) {
      showNotification('触发条件JSON格式错误', 'warning')
      return
    }
    
    await API.put(`/risk/rules/${id}`, {
      rule_name: document.getElementById('editRuleName').value,
      rule_type: document.getElementById('editRuleType').value,
      action: document.getElementById('editRuleAction').value,
      severity: document.getElementById('editRuleSeverity').value,
      rule_condition: ruleCondition,
      description: document.getElementById('editRuleDesc').value
    })
    showNotification('风控规则更新成功', 'success')
    closeAllModals()
    loadRiskRules()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

async function toggleRiskRule(id, newStatus) {
  try {
    await API.put(`/risk/rules/${id}`, { is_enabled: newStatus })
    showNotification(newStatus ? '规则已启用' : '规则已禁用', 'success')
    loadRiskRules()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

// ============================================
// 原有洗码系统功能
// ============================================

function showAddSchemeModal() {
  const content = `
    <form onsubmit="submitAddScheme(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group col-span-2">
          <label class="form-label">方案名称 *</label>
          <input type="text" id="newSchemeName" class="form-input" required placeholder="如：VIP专属洗码方案">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">方案描述</label>
          <textarea id="newSchemeDesc" class="form-input" rows="2" placeholder="方案说明..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">结算周期 *</label>
          <select id="newSchemeSettleType" class="form-select" required>
            <option value="daily">日结</option>
            <option value="weekly">周结</option>
            <option value="monthly">月结</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">最低有效投注</label>
          <input type="number" id="newSchemeMinBet" class="form-input" min="0" value="1000">
        </div>
        <div class="form-group">
          <label class="form-label">单期最高返水</label>
          <input type="number" id="newSchemeMaxPayout" class="form-input" min="0" value="100000">
        </div>
        <div class="form-group">
          <label class="form-label">自动发放阈值</label>
          <input type="number" id="newSchemeAutoThreshold" class="form-input" min="0" value="10000">
        </div>
        <div class="form-group col-span-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="newSchemeAutoSettle" checked>
            <span>启用自动结算</span>
          </label>
        </div>
      </div>
      <div class="border-t pt-4 mt-4">
        <h4 class="font-semibold mb-3">游戏返水率配置</h4>
        <div class="grid grid-3 gap-md">
          <div class="form-group">
            <label class="form-label">百家乐(%)</label>
            <input type="number" id="rateBaccarat" class="form-input" step="0.01" min="0" max="2" value="0.5">
          </div>
          <div class="form-group">
            <label class="form-label">龙虎(%)</label>
            <input type="number" id="rateDragonTiger" class="form-input" step="0.01" min="0" max="2" value="0.5">
          </div>
          <div class="form-group">
            <label class="form-label">轮盘(%)</label>
            <input type="number" id="rateRoulette" class="form-input" step="0.01" min="0" max="2" value="0.3">
          </div>
          <div class="form-group">
            <label class="form-label">骰宝(%)</label>
            <input type="number" id="rateSicbo" class="form-input" step="0.01" min="0" max="2" value="0.3">
          </div>
          <div class="form-group">
            <label class="form-label">牛牛(%)</label>
            <input type="number" id="rateBullBull" class="form-input" step="0.01" min="0" max="2" value="0.4">
          </div>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建方案</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增洗码方案', content, { width: '650px' })
}

async function submitAddScheme(e) {
  e.preventDefault()
  try {
    const rates = [
      { game_type: 'baccarat', commission_rate: parseFloat(document.getElementById('rateBaccarat').value) / 100 },
      { game_type: 'dragon_tiger', commission_rate: parseFloat(document.getElementById('rateDragonTiger').value) / 100 },
      { game_type: 'roulette', commission_rate: parseFloat(document.getElementById('rateRoulette').value) / 100 },
      { game_type: 'sicbo', commission_rate: parseFloat(document.getElementById('rateSicbo').value) / 100 },
      { game_type: 'bull_bull', commission_rate: parseFloat(document.getElementById('rateBullBull').value) / 100 }
    ]
    
    await API.post('/commission/schemes', {
      scheme_name: document.getElementById('newSchemeName').value,
      description: document.getElementById('newSchemeDesc').value,
      settle_type: document.getElementById('newSchemeSettleType').value,
      min_valid_bet: parseFloat(document.getElementById('newSchemeMinBet').value),
      max_payout: parseFloat(document.getElementById('newSchemeMaxPayout').value),
      auto_settle: document.getElementById('newSchemeAutoSettle').checked,
      auto_settle_threshold: parseFloat(document.getElementById('newSchemeAutoThreshold').value),
      rates
    })
    showNotification('洗码方案创建成功', 'success')
    closeAllModals()
    loadModule('commission')
  } catch (error) {
    showNotification('创建失败', 'danger')
  }
}

async function editScheme(id) {
  try {
    const data = await API.get(`/commission/schemes/${id}`)
    const scheme = data.data
    const rates = scheme.rates || []
    
    const getRate = (type) => {
      const r = rates.find(x => x.game_type === type)
      return r ? (r.commission_rate * 100).toFixed(2) : '0'
    }
    
    const content = `
      <form onsubmit="submitEditScheme(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group col-span-2">
            <label class="form-label">方案名称</label>
            <input type="text" id="editSchemeName" class="form-input" value="${escapeHtml(scheme.scheme_name)}" required>
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">方案描述</label>
            <textarea id="editSchemeDesc" class="form-input" rows="2">${escapeHtml(scheme.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">结算周期</label>
            <select id="editSchemeSettleType" class="form-select">
              <option value="daily" ${scheme.settle_type === 'daily' ? 'selected' : ''}>日结</option>
              <option value="weekly" ${scheme.settle_type === 'weekly' ? 'selected' : ''}>周结</option>
              <option value="monthly" ${scheme.settle_type === 'monthly' ? 'selected' : ''}>月结</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select id="editSchemeStatus" class="form-select">
              <option value="1" ${scheme.status === 1 ? 'selected' : ''}>启用</option>
              <option value="0" ${scheme.status === 0 ? 'selected' : ''}>停用</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">最低有效投注</label>
            <input type="number" id="editSchemeMinBet" class="form-input" value="${scheme.min_valid_bet || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">单期最高返水</label>
            <input type="number" id="editSchemeMaxPayout" class="form-input" value="${scheme.max_payout || 0}">
          </div>
        </div>
        <div class="border-t pt-4 mt-4">
          <h4 class="font-semibold mb-3">游戏返水率(%)</h4>
          <div class="grid grid-5 gap-md">
            <div class="form-group">
              <label class="form-label text-xs">百家乐</label>
              <input type="number" id="editRateBaccarat" class="form-input" step="0.01" value="${getRate('baccarat')}">
            </div>
            <div class="form-group">
              <label class="form-label text-xs">龙虎</label>
              <input type="number" id="editRateDragonTiger" class="form-input" step="0.01" value="${getRate('dragon_tiger')}">
            </div>
            <div class="form-group">
              <label class="form-label text-xs">轮盘</label>
              <input type="number" id="editRateRoulette" class="form-input" step="0.01" value="${getRate('roulette')}">
            </div>
            <div class="form-group">
              <label class="form-label text-xs">骰宝</label>
              <input type="number" id="editRateSicbo" class="form-input" step="0.01" value="${getRate('sicbo')}">
            </div>
            <div class="form-group">
              <label class="form-label text-xs">牛牛</label>
              <input type="number" id="editRateBullBull" class="form-input" step="0.01" value="${getRate('bull_bull')}">
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal(`编辑洗码方案 - ${escapeHtml(scheme.scheme_name)}`, content, { width: '650px' })
  } catch (error) {
    showNotification('获取方案详情失败', 'danger')
  }
}

async function submitEditScheme(e, id) {
  e.preventDefault()
  try {
    const rates = [
      { game_type: 'baccarat', commission_rate: parseFloat(document.getElementById('editRateBaccarat').value) / 100 },
      { game_type: 'dragon_tiger', commission_rate: parseFloat(document.getElementById('editRateDragonTiger').value) / 100 },
      { game_type: 'roulette', commission_rate: parseFloat(document.getElementById('editRateRoulette').value) / 100 },
      { game_type: 'sicbo', commission_rate: parseFloat(document.getElementById('editRateSicbo').value) / 100 },
      { game_type: 'bull_bull', commission_rate: parseFloat(document.getElementById('editRateBullBull').value) / 100 }
    ]
    
    await API.put(`/commission/schemes/${id}`, {
      scheme_name: document.getElementById('editSchemeName').value,
      description: document.getElementById('editSchemeDesc').value,
      settle_type: document.getElementById('editSchemeSettleType').value,
      min_valid_bet: parseFloat(document.getElementById('editSchemeMinBet').value),
      max_payout: parseFloat(document.getElementById('editSchemeMaxPayout').value),
      status: parseInt(document.getElementById('editSchemeStatus').value),
      rates
    })
    showNotification('方案更新成功', 'success')
    closeAllModals()
    loadModule('commission')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

async function bindPlayersToScheme(schemeId) {
  const playerIds = prompt('请输入要绑定的玩家ID(多个用逗号分隔):')
  if (!playerIds) return
  
  try {
    const ids = playerIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    await API.post('/commission/bind', { player_ids: ids, scheme_id: schemeId })
    showNotification(`已为${ids.length}名玩家绑定方案`, 'success')
    loadModule('commission')
  } catch (error) {
    showNotification('绑定失败', 'danger')
  }
}

async function batchApproveCommission() {
  const checkboxes = document.querySelectorAll('.commission-checkbox:checked')
  if (checkboxes.length === 0) {
    showNotification('请选择要审核的洗码', 'warning')
    return
  }
  
  if (!confirm(`确定要批量通过${checkboxes.length}条洗码吗？`)) return
  
  try {
    for (const cb of checkboxes) {
      await API.post(`/commission/${cb.value}/review`, { action: 'approve' })
    }
    showNotification(`已批量通过${checkboxes.length}条洗码`, 'success')
    loadModule('commission')
  } catch (error) {
    showNotification('批量审核失败', 'danger')
  }
}

function generateCommission() {
  const content = `
    <form onsubmit="submitGenerateCommission(event)">
      <div class="form-group">
        <label class="form-label">玩家ID *</label>
        <input type="number" id="genCommissionPlayerId" class="form-input" required>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">开始日期 *</label>
          <input type="date" id="genCommissionDateFrom" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">结束日期 *</label>
          <input type="date" id="genCommissionDateTo" class="form-input" required>
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">生成洗码</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('手动生成洗码', content, { width: '400px' })
}

async function submitGenerateCommission(e) {
  e.preventDefault()
  try {
    const result = await API.post('/commission/generate', {
      player_id: parseInt(document.getElementById('genCommissionPlayerId').value),
      date_from: document.getElementById('genCommissionDateFrom').value,
      date_to: document.getElementById('genCommissionDateTo').value
    })
    showNotification(`洗码生成成功，金额: ${formatCurrency(result.data?.totalCommission || 0)}`, 'success')
    closeAllModals()
    loadModule('commission')
  } catch (error) {
    showNotification('生成失败: ' + (error.response?.data?.error || ''), 'danger')
  }
}

function toggleSelectAllCommission() {
  const selectAll = document.getElementById('selectAllCommission')
  document.querySelectorAll('.commission-checkbox').forEach(cb => {
    cb.checked = selectAll.checked
  })
}

// ============================================
// 完整功能实现 - 风控管理
// ============================================

function showAddLimitModal() {
  const content = `
    <form onsubmit="submitAddLimit(event)">
      <div class="form-group">
        <label class="form-label">配置名称 *</label>
        <input type="text" id="newLimitName" class="form-input" required placeholder="如：VIP限红配置">
      </div>
      <div class="form-group">
        <label class="form-label">游戏类型 *</label>
        <select id="newLimitGameType" class="form-select" required>
          <option value="baccarat">百家乐</option>
          <option value="dragon_tiger">龙虎</option>
          <option value="roulette">轮盘</option>
          <option value="sicbo">骰宝</option>
          <option value="bull_bull">牛牛</option>
        </select>
      </div>
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">最小投注</label>
          <input type="number" id="newLimitMinBet" class="form-input" min="0" value="10">
        </div>
        <div class="form-group">
          <label class="form-label">最大投注</label>
          <input type="number" id="newLimitMaxBet" class="form-input" min="0" value="100000">
        </div>
        <div class="form-group">
          <label class="form-label">单局最高赔付</label>
          <input type="number" id="newLimitMaxPayout" class="form-input" min="0" value="500000">
        </div>
        <div class="form-group">
          <label class="form-label">日最高赢额</label>
          <input type="number" id="newLimitDailyMaxWin" class="form-input" min="0" value="1000000">
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建配置</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增限红配置', content, { width: '500px' })
}

async function submitAddLimit(e) {
  e.preventDefault()
  try {
    await API.post('/risk/limits', {
      config_name: document.getElementById('newLimitName').value,
      game_type: document.getElementById('newLimitGameType').value,
      min_bet: parseFloat(document.getElementById('newLimitMinBet').value),
      max_bet: parseFloat(document.getElementById('newLimitMaxBet').value),
      max_payout: parseFloat(document.getElementById('newLimitMaxPayout').value),
      daily_max_win: parseFloat(document.getElementById('newLimitDailyMaxWin').value)
    })
    showNotification('限红配置创建成功', 'success')
    closeAllModals()
    loadModule('risk')
  } catch (error) {
    showNotification('创建失败', 'danger')
  }
}

async function editLimit(id) {
  try {
    const data = await API.get('/risk/limits')
    const limit = data.data.find(l => l.id === id)
    if (!limit) throw new Error('配置不存在')
    
    const content = `
      <form onsubmit="submitEditLimit(event, ${id})">
        <div class="form-group">
          <label class="form-label">配置名称</label>
          <input type="text" id="editLimitName" class="form-input" value="${escapeHtml(limit.config_name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">游戏类型</label>
          <select id="editLimitGameType" class="form-select">
            <option value="baccarat" ${limit.game_type === 'baccarat' ? 'selected' : ''}>百家乐</option>
            <option value="dragon_tiger" ${limit.game_type === 'dragon_tiger' ? 'selected' : ''}>龙虎</option>
            <option value="roulette" ${limit.game_type === 'roulette' ? 'selected' : ''}>轮盘</option>
            <option value="sicbo" ${limit.game_type === 'sicbo' ? 'selected' : ''}>骰宝</option>
            <option value="bull_bull" ${limit.game_type === 'bull_bull' ? 'selected' : ''}>牛牛</option>
          </select>
        </div>
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">最小投注</label>
            <input type="number" id="editLimitMinBet" class="form-input" value="${limit.min_bet}">
          </div>
          <div class="form-group">
            <label class="form-label">最大投注</label>
            <input type="number" id="editLimitMaxBet" class="form-input" value="${limit.max_bet}">
          </div>
          <div class="form-group">
            <label class="form-label">单局最高赔付</label>
            <input type="number" id="editLimitMaxPayout" class="form-input" value="${limit.max_payout}">
          </div>
          <div class="form-group">
            <label class="form-label">日最高赢额</label>
            <input type="number" id="editLimitDailyMaxWin" class="form-input" value="${limit.daily_max_win}">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑限红配置', content, { width: '500px' })
  } catch (error) {
    showNotification('获取配置失败', 'danger')
  }
}

async function submitEditLimit(e, id) {
  e.preventDefault()
  try {
    await API.post('/risk/limits', {
      id,
      config_name: document.getElementById('editLimitName').value,
      game_type: document.getElementById('editLimitGameType').value,
      min_bet: parseFloat(document.getElementById('editLimitMinBet').value),
      max_bet: parseFloat(document.getElementById('editLimitMaxBet').value),
      max_payout: parseFloat(document.getElementById('editLimitMaxPayout').value),
      daily_max_win: parseFloat(document.getElementById('editLimitDailyMaxWin').value)
    })
    showNotification('限红配置更新成功', 'success')
    closeAllModals()
    loadModule('risk')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

// ============================================
// 完整功能实现 - 现场运营(桌台、荷官、排班)
// ============================================

function showAddTableModal() {
  const content = `
    <form onsubmit="submitAddTable(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">桌台编号 *</label>
          <input type="text" id="newTableCode" class="form-input" required placeholder="BAC-001">
        </div>
        <div class="form-group">
          <label class="form-label">桌台名称 *</label>
          <input type="text" id="newTableName" class="form-input" required placeholder="百家乐1号桌">
        </div>
        <div class="form-group">
          <label class="form-label">游戏类型 *</label>
          <select id="newTableGameType" class="form-select" required>
            <option value="baccarat">百家乐</option>
            <option value="dragon_tiger">龙虎</option>
            <option value="roulette">轮盘</option>
            <option value="sicbo">骰宝</option>
            <option value="bull_bull">牛牛</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">限红组</label>
          <select id="newTableLimitGroup" class="form-select">
            <option value="A">A组</option>
            <option value="B">B组</option>
            <option value="VIP">VIP组</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">最小投注</label>
          <input type="number" id="newTableMinBet" class="form-input" value="10">
        </div>
        <div class="form-group">
          <label class="form-label">最大投注</label>
          <input type="number" id="newTableMaxBet" class="form-input" value="100000">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">主视频流URL</label>
          <input type="url" id="newTableVideoMain" class="form-input" placeholder="rtmp://...">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">备用视频流URL</label>
          <input type="url" id="newTableVideoBackup" class="form-input" placeholder="https://...">
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建桌台</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增桌台', content, { width: '550px' })
}

async function submitAddTable(e) {
  e.preventDefault()
  try {
    await API.post('/tables', {
      table_code: document.getElementById('newTableCode').value,
      table_name: document.getElementById('newTableName').value,
      game_type: document.getElementById('newTableGameType').value,
      limit_group: document.getElementById('newTableLimitGroup').value,
      min_bet: parseFloat(document.getElementById('newTableMinBet').value),
      max_bet: parseFloat(document.getElementById('newTableMaxBet').value),
      video_stream_main: document.getElementById('newTableVideoMain').value,
      video_stream_backup: document.getElementById('newTableVideoBackup').value
    })
    showNotification('桌台创建成功', 'success')
    closeAllModals()
    loadModule('studio')
  } catch (error) {
    showNotification('创建失败', 'danger')
  }
}

async function editTable(id) {
  try {
    const data = await API.get('/tables')
    const table = data.data.find(t => t.id === id)
    if (!table) throw new Error('桌台不存在')
    
    const content = `
      <form onsubmit="submitEditTable(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">桌台编号</label>
            <input type="text" class="form-input" value="${escapeHtml(table.table_code)}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">桌台名称</label>
            <input type="text" id="editTableName" class="form-input" value="${escapeHtml(table.table_name)}">
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select id="editTableStatus" class="form-select">
              <option value="1" ${table.status === 1 ? 'selected' : ''}>运行中</option>
              <option value="0" ${table.status === 0 ? 'selected' : ''}>维护中</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">限红组</label>
            <select id="editTableLimitGroup" class="form-select">
              <option value="A" ${table.limit_group === 'A' ? 'selected' : ''}>A组</option>
              <option value="B" ${table.limit_group === 'B' ? 'selected' : ''}>B组</option>
              <option value="VIP" ${table.limit_group === 'VIP' ? 'selected' : ''}>VIP组</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">最小投注</label>
            <input type="number" id="editTableMinBet" class="form-input" value="${table.min_bet}">
          </div>
          <div class="form-group">
            <label class="form-label">最大投注</label>
            <input type="number" id="editTableMaxBet" class="form-input" value="${table.max_bet}">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">主视频流</label>
            <input type="url" id="editTableVideoMain" class="form-input" value="${escapeHtml(table.video_stream_main || '')}">
          </div>
          <div class="form-group col-span-2">
            <label class="form-label">备用视频流</label>
            <input type="url" id="editTableVideoBackup" class="form-input" value="${escapeHtml(table.video_stream_backup || '')}">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal(`编辑桌台 - ${escapeHtml(table.table_code)}`, content, { width: '550px' })
  } catch (error) {
    showNotification('获取桌台信息失败', 'danger')
  }
}

async function submitEditTable(e, id) {
  e.preventDefault()
  try {
    await API.put(`/tables/${id}`, {
      table_name: document.getElementById('editTableName').value,
      status: parseInt(document.getElementById('editTableStatus').value),
      limit_group: document.getElementById('editTableLimitGroup').value,
      min_bet: parseFloat(document.getElementById('editTableMinBet').value),
      max_bet: parseFloat(document.getElementById('editTableMaxBet').value),
      video_stream_main: document.getElementById('editTableVideoMain').value,
      video_stream_backup: document.getElementById('editTableVideoBackup').value
    })
    showNotification('桌台更新成功', 'success')
    closeAllModals()
    loadModule('studio')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

function showAddDealerModal() {
  const content = `
    <form onsubmit="submitAddDealer(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">工号 *</label>
          <input type="text" id="newDealerEmployeeNo" class="form-input" required placeholder="D001">
        </div>
        <div class="form-group">
          <label class="form-label">艺名(中) *</label>
          <input type="text" id="newDealerStageName" class="form-input" required placeholder="小雅">
        </div>
        <div class="form-group">
          <label class="form-label">艺名(英)</label>
          <input type="text" id="newDealerStageNameEn" class="form-input" placeholder="Yaya">
        </div>
        <div class="form-group">
          <label class="form-label">真实姓名</label>
          <input type="text" id="newDealerRealName" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">性别</label>
          <select id="newDealerGender" class="form-select">
            <option value="F">女</option>
            <option value="M">男</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input type="tel" id="newDealerPhone" class="form-input">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">邮箱</label>
          <input type="email" id="newDealerEmail" class="form-input">
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建荷官</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增荷官', content, { width: '500px' })
}

async function submitAddDealer(e) {
  e.preventDefault()
  try {
    await API.post('/dealers', {
      employee_no: document.getElementById('newDealerEmployeeNo').value,
      stage_name: document.getElementById('newDealerStageName').value,
      stage_name_en: document.getElementById('newDealerStageNameEn').value,
      real_name: document.getElementById('newDealerRealName').value,
      gender: document.getElementById('newDealerGender').value,
      phone: document.getElementById('newDealerPhone').value,
      email: document.getElementById('newDealerEmail').value
    })
    showNotification('荷官创建成功', 'success')
    closeAllModals()
    loadModule('studio')
  } catch (error) {
    showNotification('创建失败', 'danger')
  }
}

async function viewDealerDetail(id) {
  try {
    const data = await API.get(`/dealers/${id}`)
    const dealer = data.data
    
    const content = `
      <div class="grid grid-2 gap-lg mb-4">
        <div>
          <h4 class="font-semibold mb-3">基本信息</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">工号</span><span class="font-mono">${escapeHtml(dealer.employee_no)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">艺名</span><span class="font-semibold">${escapeHtml(dealer.stage_name)} ${dealer.stage_name_en ? `(${escapeHtml(dealer.stage_name_en)})` : ''}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">真实姓名</span><span>${escapeHtml(dealer.real_name || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">性别</span><span>${dealer.gender === 'F' ? '女' : '男'}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">状态</span>${getStatusBadge(dealer.status, 'dealer')}</div>
            <div class="flex justify-between"><span class="text-gray-500">评分</span><span class="text-yellow-500">${'★'.repeat(dealer.rating || 3)}${'☆'.repeat(5 - (dealer.rating || 3))}</span></div>
          </div>
        </div>
        <div>
          <h4 class="font-semibold mb-3">联系方式</h4>
          <div class="space-y-sm">
            <div class="flex justify-between"><span class="text-gray-500">手机</span><span>${escapeHtml(dealer.phone || '-')}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">邮箱</span><span>${escapeHtml(dealer.email || '-')}</span></div>
          </div>
        </div>
      </div>
      ${dealer.shifts && dealer.shifts.length > 0 ? `
        <div>
          <h4 class="font-semibold mb-2">最近排班</h4>
          <div class="text-sm">
            ${dealer.shifts.slice(0, 5).map(s => `
              <div class="flex justify-between py-1 border-b">
                <span>${s.shift_date} ${s.start_time}-${s.end_time}</span>
                <span class="text-gray-500">${escapeHtml(s.table_name || '-')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `
    showModal(`荷官详情 - ${escapeHtml(dealer.stage_name)}`, content, { width: '550px' })
  } catch (error) {
    showNotification('获取荷官详情失败', 'danger')
  }
}

async function showAddShiftModal() {
  try {
    const [dealersData, tablesData] = await Promise.all([
      API.get('/dealers'),
      API.get('/tables')
    ])
    
    const content = `
      <form onsubmit="submitAddShift(event)">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">荷官 *</label>
            <select id="newShiftDealerId" class="form-select" required>
              <option value="">-- 请选择 --</option>
              ${(dealersData.data || []).map(d => `<option value="${d.id}">${escapeHtml(d.stage_name)} (${escapeHtml(d.employee_no)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">桌台 *</label>
            <select id="newShiftTableId" class="form-select" required>
              <option value="">-- 请选择 --</option>
              ${(tablesData.data || []).map(t => `<option value="${t.id}">${escapeHtml(t.table_name)} (${escapeHtml(t.table_code)})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">排班日期 *</label>
            <input type="date" id="newShiftDate" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">备注</label>
            <input type="text" id="newShiftNotes" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">开始时间 *</label>
            <input type="time" id="newShiftStartTime" class="form-input" required value="08:00">
          </div>
          <div class="form-group">
            <label class="form-label">结束时间 *</label>
            <input type="time" id="newShiftEndTime" class="form-input" required value="16:00">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">创建排班</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('新增排班', content, { width: '500px' })
  } catch (error) {
    showNotification('获取数据失败', 'danger')
  }
}

async function submitAddShift(e) {
  e.preventDefault()
  try {
    await API.post('/shifts', {
      dealer_id: parseInt(document.getElementById('newShiftDealerId').value),
      table_id: parseInt(document.getElementById('newShiftTableId').value),
      shift_date: document.getElementById('newShiftDate').value,
      start_time: document.getElementById('newShiftStartTime').value,
      end_time: document.getElementById('newShiftEndTime').value,
      notes: document.getElementById('newShiftNotes').value
    })
    showNotification('排班创建成功', 'success')
    closeAllModals()
    loadModule('studio')
  } catch (error) {
    showNotification('创建失败: ' + (error.response?.data?.error || ''), 'danger')
  }
}

async function editShift(id) {
  showNotification('排班编辑功能开发中', 'info')
}

async function cancelShift(id) {
  if (!confirm('确定要取消该排班吗？')) return
  try {
    await API.delete(`/shifts/${id}`)
    showNotification('排班已取消', 'success')
    loadModule('studio')
  } catch (error) {
    showNotification('取消失败', 'danger')
  }
}

// ============================================
// 完整功能实现 - 报表与内容管理
// ============================================

function exportReport() {
  showNotification('报表导出功能开发中，敬请期待', 'info')
}

// ============================================
// 报表中心 - 切换与加载函数
// ============================================

// 切换报表标签
function switchReportTab(tab) {
  // 更新标签状态
  const tabs = document.querySelectorAll('.card .tabs .tab')
  tabs.forEach(t => t.classList.remove('active'))
  event.target.closest('.tab').classList.add('active')
  
  // 根据标签加载不同报表
  switch(tab) {
    case 'daily': loadDailyReport(); break
    case 'shareholder': loadShareholderReport(); break
    case 'agent': loadAgentReport(); break
    case 'player': loadPlayerReport(); break
    case 'game': loadGameReport(); break
    case 'commission': loadCommissionReport(); break
    case 'transfers': loadTransfersData(); break
    case 'fee-settings': loadFeeSettingsData(); break
  }
}

// 加载日报表
async function loadDailyReport() {
  const container = document.getElementById('reportContent')
  if (!container) return
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const dailyData = await API.get('/reports/daily', { date: today })
    const stats = dailyData.data
    
    container.innerHTML = `
      <!-- 日期选择器 -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">选择日期:</label>
          <input type="date" id="dailyReportDate" class="form-input form-input-sm" value="${today}" onchange="loadDailyReportByDate()">
        </div>
        <button onclick="exportDailyReport()" class="btn btn-success btn-sm">
          <i class="fas fa-download mr-1"></i> 导出日报表
        </button>
      </div>
      
      <!-- 统计卡片 -->
      <div class="stats-grid mb-6">
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon blue"><i class="fas fa-dice"></i></div>
          </div>
          <div class="stat-card-value">${formatCurrency(stats.betStats?.total_bet_amount || 0)}</div>
          <div class="stat-card-label">总投注额 (${stats.betStats?.total_bets || 0}笔)</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon ${(stats.netProfit || 0) >= 0 ? 'green' : 'red'}"><i class="fas fa-chart-line"></i></div>
          </div>
          <div class="stat-card-value">${formatCurrency(stats.netProfit || 0)}</div>
          <div class="stat-card-label">公司${(stats.netProfit || 0) >= 0 ? '盈利' : '亏损'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon green"><i class="fas fa-arrow-down"></i></div>
          </div>
          <div class="stat-card-value">${formatCurrency(stats.depositStats?.total || 0)}</div>
          <div class="stat-card-label">存款 (${stats.depositStats?.count || 0}笔)</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon red"><i class="fas fa-arrow-up"></i></div>
          </div>
          <div class="stat-card-value">${formatCurrency(stats.withdrawalStats?.total || 0)}</div>
          <div class="stat-card-label">提款 (${stats.withdrawalStats?.count || 0}笔)</div>
        </div>
      </div>
      
      <!-- 综合数据 -->
      <div class="grid grid-2 gap-lg mb-6">
        <div class="bg-white rounded-lg border p-4">
          <h4 class="font-semibold mb-3">玩家统计</h4>
          <div class="grid grid-2 gap-md">
            <div class="text-center p-3 bg-blue-50 rounded-lg">
              <div class="text-2xl font-bold text-blue-600">${stats.newPlayers || 0}</div>
              <div class="text-xs text-gray-500">新增玩家</div>
            </div>
            <div class="text-center p-3 bg-green-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">${stats.activePlayers || 0}</div>
              <div class="text-xs text-gray-500">活跃玩家</div>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg border p-4">
          <h4 class="font-semibold mb-3">资金概况</h4>
          <div class="grid grid-2 gap-md">
            <div class="text-center p-3 bg-emerald-50 rounded-lg">
              <div class="text-2xl font-bold text-emerald-600">${formatCurrency((stats.depositStats?.total || 0) - (stats.withdrawalStats?.total || 0))}</div>
              <div class="text-xs text-gray-500">净流入</div>
            </div>
            <div class="text-center p-3 bg-purple-50 rounded-lg">
              <div class="text-2xl font-bold text-purple-600">${formatCurrency(stats.betStats?.total_valid_bet || stats.betStats?.total_bet_amount || 0)}</div>
              <div class="text-xs text-gray-500">有效投注</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 游戏类型分布 -->
      ${stats.gameDistribution && stats.gameDistribution.length > 0 ? `
        <h4 class="font-semibold mb-3">游戏类型分布</h4>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>游戏类型</th>
                <th class="text-right">投注笔数</th>
                <th class="text-right">投注金额</th>
                <th class="text-right">有效投注</th>
                <th class="text-right">公司盈亏</th>
              </tr>
            </thead>
            <tbody>
              ${stats.gameDistribution.map(g => `
                <tr>
                  <td><span class="badge badge-purple">${getGameTypeName(g.game_type)}</span></td>
                  <td class="text-right">${g.bet_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(g.bet_amount || 0)}</td>
                  <td class="text-right font-mono">${formatCurrency(g.valid_bet || g.bet_amount || 0)}</td>
                  <td class="text-right font-mono ${(g.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(g.profit || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : showEmpty('chart-bar', '暂无游戏数据')}
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 按日期加载日报表
async function loadDailyReportByDate() {
  const date = document.getElementById('dailyReportDate')?.value
  if (!date) return
  
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  try {
    const dailyData = await API.get('/reports/daily', { date })
    // 重新渲染日报表内容
    loadDailyReport()
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败')
  }
}

// 加载股东报表
async function loadShareholderReport() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/reports/shareholder', { date_from: monthAgo, date_to: today })
    const shareholders = result.data?.shareholders || []
    
    container.innerHTML = `
      <!-- 筛选器 -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">日期范围:</label>
          <input type="date" id="shDateFrom" class="form-input form-input-sm" value="${monthAgo}">
          <span class="text-gray-400">至</span>
          <input type="date" id="shDateTo" class="form-input form-input-sm" value="${today}">
        </div>
        <button onclick="searchShareholderReport()" class="btn btn-primary btn-sm"><i class="fas fa-search mr-1"></i>查询</button>
        <button onclick="exportShareholderReport()" class="btn btn-success btn-sm"><i class="fas fa-download mr-1"></i>导出</button>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>股东账号</th>
              <th class="text-right">直属会员</th>
              <th class="text-right">下级代理</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">有效投注</th>
              <th class="text-right">会员输赢</th>
              <th class="text-right">公司盈利</th>
              <th class="text-right">预计佣金</th>
            </tr>
          </thead>
          <tbody>
            ${shareholders.length === 0 ? `<tr><td colspan="8">${showEmpty('user-tie', '暂无股东数据')}</td></tr>` :
              shareholders.map(s => `
                <tr>
                  <td class="font-semibold">${escapeHtml(s.shareholder_name || '-')}</td>
                  <td class="text-right">${s.total_players || 0}</td>
                  <td class="text-right">${s.sub_agent_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(s.total_bet || 0)}</td>
                  <td class="text-right font-mono">${formatCurrency(s.valid_bet || 0)}</td>
                  <td class="text-right font-mono ${(s.player_loss - s.player_win) >= 0 ? 'text-red-600' : 'text-emerald-600'}">
                    ${formatCurrency((s.player_win || 0) - (s.player_loss || 0))}
                  </td>
                  <td class="text-right font-mono font-semibold ${(s.company_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(s.company_profit || 0)}
                  </td>
                  <td class="text-right font-mono text-purple-600">${formatCurrency(s.commission || 0)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载代理报表
async function loadAgentReport() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/reports/agents', { date_from: monthAgo, date_to: today })
    const agents = result.data || []
    
    container.innerHTML = `
      <!-- 筛选器 -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">日期范围:</label>
          <input type="date" id="agentDateFrom" class="form-input form-input-sm" value="${monthAgo}">
          <span class="text-gray-400">至</span>
          <input type="date" id="agentDateTo" class="form-input form-input-sm" value="${today}">
        </div>
        <button onclick="searchAgentReport()" class="btn btn-primary btn-sm"><i class="fas fa-search mr-1"></i>查询</button>
        <button onclick="exportAgentReport()" class="btn btn-success btn-sm"><i class="fas fa-download mr-1"></i>导出</button>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>代理账号</th>
              <th class="text-center">层级</th>
              <th class="text-right">直属会员</th>
              <th class="text-right">投注笔数</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">公司盈利</th>
              <th class="text-right">佣金比例</th>
            </tr>
          </thead>
          <tbody>
            ${agents.length === 0 ? `<tr><td colspan="7">${showEmpty('users', '暂无代理数据')}</td></tr>` :
              agents.map(a => `
                <tr>
                  <td class="font-semibold">${escapeHtml(a.username || '-')}</td>
                  <td class="text-center">
                    <span class="badge ${a.agent_level === 1 ? 'badge-danger' : a.agent_level === 2 ? 'badge-warning' : 'badge-info'}">
                      ${a.agent_level === 1 ? '股东' : a.agent_level === 2 ? '总代' : '代理'}
                    </span>
                  </td>
                  <td class="text-right">${a.player_count || 0}</td>
                  <td class="text-right">${a.bet_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(a.total_bet || 0)}</td>
                  <td class="text-right font-mono font-semibold ${(a.profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(a.profit || 0)}
                  </td>
                  <td class="text-right font-mono text-purple-600">${(a.commission_rate || 0)}%</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载会员报表
async function loadPlayerReport() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/reports/players', { date_from: monthAgo, date_to: today, limit: 100 })
    const players = result.data || []
    
    container.innerHTML = `
      <!-- 高级筛选器 -->
      <div class="bg-gray-50 p-4 rounded-lg mb-4">
        <form id="playerReportSearchForm" onsubmit="searchPlayerReport(event)">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">会员账号</label>
              <input type="text" id="playerUsernameSearch" class="form-input form-input-sm" placeholder="输入会员账号">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">会员ID</label>
              <input type="number" id="playerIdSearch" class="form-input form-input-sm" placeholder="输入会员ID">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">代理ID</label>
              <input type="number" id="playerAgentIdSearch" class="form-input form-input-sm" placeholder="输入代理ID">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">最小投注额</label>
              <input type="number" id="playerMinBet" class="form-input form-input-sm" placeholder="最小投注额" min="0">
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">开始日期</label>
              <input type="date" id="playerDateFrom" class="form-input form-input-sm" value="${monthAgo}">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">结束日期</label>
              <input type="date" id="playerDateTo" class="form-input form-input-sm" value="${today}">
            </div>
            <div class="col-span-2 flex items-end gap-2">
              <button type="submit" class="btn btn-primary btn-sm">
                <i class="fas fa-search mr-1"></i>查询
              </button>
              <button type="button" onclick="resetPlayerReportFilter()" class="btn btn-secondary btn-sm">
                <i class="fas fa-undo mr-1"></i>重置
              </button>
              <button type="button" onclick="exportPlayerReport()" class="btn btn-success btn-sm">
                <i class="fas fa-download mr-1"></i>导出
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>会员账号</th>
              <th>代理</th>
              <th class="text-center">VIP</th>
              <th class="text-right">投注笔数</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">有效投注</th>
              <th class="text-right">会员盈利</th>
              <th class="text-right">会员亏损</th>
              <th class="text-right">净盈亏</th>
              <th class="text-right">总充值</th>
              <th class="text-right">总提款</th>
            </tr>
          </thead>
          <tbody>
            ${players.length === 0 ? `<tr><td colspan="11">${showEmpty('user', '暂无会员数据')}</td></tr>` :
              players.map(p => `
                <tr>
                  <td class="font-semibold">${escapeHtml(p.username || '-')}</td>
                  <td class="text-gray-600 text-sm">${escapeHtml(p.agent_name || '-')}</td>
                  <td class="text-center"><span class="badge badge-warning">VIP${p.vip_level || 0}</span></td>
                  <td class="text-right">${p.bet_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(p.total_bet || 0)}</td>
                  <td class="text-right font-mono">${formatCurrency(p.valid_bet || 0)}</td>
                  <td class="text-right font-mono text-emerald-600">${formatCurrency(p.player_win || 0)}</td>
                  <td class="text-right font-mono text-red-600">${formatCurrency(p.player_loss || 0)}</td>
                  <td class="text-right font-mono font-semibold ${(p.net_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(p.net_profit || 0)}
                  </td>
                  <td class="text-right font-mono text-blue-600">${formatCurrency(p.total_deposit || 0)}</td>
                  <td class="text-right font-mono text-orange-600">${formatCurrency(p.total_withdrawal || 0)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载游戏报表
async function loadGameReport() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/reports/games', { date_from: monthAgo, date_to: today })
    const byGame = result.data?.byGame || []
    const byTable = result.data?.byTable || []
    const byBetType = result.data?.byBetType || []
    
    container.innerHTML = `
      <!-- 筛选器 -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">日期范围:</label>
          <input type="date" id="gameDateFrom" class="form-input form-input-sm" value="${monthAgo}">
          <span class="text-gray-400">至</span>
          <input type="date" id="gameDateTo" class="form-input form-input-sm" value="${today}">
        </div>
        <select id="gameTypeSelect" class="form-select form-input-sm">
          <option value="">全部游戏</option>
          <option value="baccarat">百家乐</option>
          <option value="dragon_tiger">龙虎</option>
          <option value="roulette">轮盘</option>
          <option value="sicbo">骰宝</option>
        </select>
        <button onclick="searchGameReport()" class="btn btn-primary btn-sm"><i class="fas fa-search mr-1"></i>查询</button>
        <button onclick="exportGameReport()" class="btn btn-success btn-sm"><i class="fas fa-download mr-1"></i>导出</button>
      </div>
      
      <!-- 游戏类型统计 -->
      <h4 class="font-semibold mb-3">按游戏类型统计</h4>
      <div class="data-table-wrapper mb-6">
        <table class="data-table">
          <thead>
            <tr>
              <th>游戏类型</th>
              <th class="text-right">投注笔数</th>
              <th class="text-right">参与人数</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">总派彩</th>
              <th class="text-right">公司盈利</th>
              <th class="text-right">平均投注</th>
              <th class="text-right">最大单注</th>
            </tr>
          </thead>
          <tbody>
            ${byGame.length === 0 ? `<tr><td colspan="8">${showEmpty('dice', '暂无游戏数据')}</td></tr>` :
              byGame.map(g => `
                <tr>
                  <td><span class="badge badge-purple">${getGameTypeName(g.game_type)}</span></td>
                  <td class="text-right">${g.bet_count || 0}</td>
                  <td class="text-right">${g.player_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(g.total_bet || 0)}</td>
                  <td class="text-right font-mono">${formatCurrency(g.total_payout || 0)}</td>
                  <td class="text-right font-mono font-semibold ${(g.company_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(g.company_profit || 0)}
                  </td>
                  <td class="text-right font-mono">${formatCurrency(g.avg_bet || 0)}</td>
                  <td class="text-right font-mono text-orange-600">${formatCurrency(g.max_bet || 0)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- 桌台统计 -->
      <h4 class="font-semibold mb-3">按桌台统计 (Top 20)</h4>
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>桌台名称</th>
              <th class="text-center">游戏类型</th>
              <th class="text-right">投注笔数</th>
              <th class="text-right">参与人数</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">公司盈利</th>
            </tr>
          </thead>
          <tbody>
            ${byTable.length === 0 ? `<tr><td colspan="6">${showEmpty('table', '暂无桌台数据')}</td></tr>` :
              byTable.map(t => `
                <tr>
                  <td class="font-semibold">${escapeHtml(t.table_name || '-')}</td>
                  <td class="text-center"><span class="badge badge-info">${getGameTypeName(t.game_type)}</span></td>
                  <td class="text-right">${t.bet_count || 0}</td>
                  <td class="text-right">${t.player_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(t.total_bet || 0)}</td>
                  <td class="text-right font-mono font-semibold ${(t.company_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(t.company_profit || 0)}
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载佣金报表
async function loadCommissionReport() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/reports/commission', { date_from: monthAgo, date_to: today })
    const commissions = result.data || []
    const summary = result.summary || {}
    
    container.innerHTML = `
      <!-- 筛选器 -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">日期范围:</label>
          <input type="date" id="commDateFrom" class="form-input form-input-sm" value="${monthAgo}">
          <span class="text-gray-400">至</span>
          <input type="date" id="commDateTo" class="form-input form-input-sm" value="${today}">
        </div>
        <select id="commStatusFilter" class="form-select form-input-sm">
          <option value="">全部状态</option>
          <option value="0">待审核</option>
          <option value="1">已结算</option>
          <option value="2">已拒绝</option>
        </select>
        <button onclick="searchCommissionReport()" class="btn btn-primary btn-sm"><i class="fas fa-search mr-1"></i>查询</button>
        <button onclick="exportCommissionReport()" class="btn btn-success btn-sm"><i class="fas fa-download mr-1"></i>导出</button>
      </div>
      
      <!-- 统计卡片 -->
      <div class="grid grid-4 gap-md mb-6">
        <div class="text-center p-3 bg-blue-50 rounded-lg">
          <div class="text-2xl font-bold text-blue-600">${summary.total_count || 0}</div>
          <div class="text-xs text-gray-500">总记录数</div>
        </div>
        <div class="text-center p-3 bg-indigo-50 rounded-lg">
          <div class="text-2xl font-bold text-indigo-600">${formatCurrency(summary.total_valid_bet || 0)}</div>
          <div class="text-xs text-gray-500">总有效投注</div>
        </div>
        <div class="text-center p-3 bg-orange-50 rounded-lg">
          <div class="text-2xl font-bold text-orange-600">${formatCurrency(summary.pending_commission || 0)}</div>
          <div class="text-xs text-gray-500">待审核佣金</div>
        </div>
        <div class="text-center p-3 bg-emerald-50 rounded-lg">
          <div class="text-2xl font-bold text-emerald-600">${formatCurrency(summary.approved_commission || 0)}</div>
          <div class="text-xs text-gray-500">已结算佣金</div>
        </div>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>会员账号</th>
              <th>代理</th>
              <th>洗码方案</th>
              <th class="text-center">结算周期</th>
              <th class="text-right">有效投注</th>
              <th class="text-right">佣金比例</th>
              <th class="text-right">佣金金额</th>
              <th class="text-center">状态</th>
            </tr>
          </thead>
          <tbody>
            ${commissions.length === 0 ? `<tr><td colspan="8">${showEmpty('coins', '暂无佣金记录')}</td></tr>` :
              commissions.map(c => `
                <tr>
                  <td class="font-semibold">${escapeHtml(c.username || '-')}</td>
                  <td class="text-gray-600 text-sm">${escapeHtml(c.agent_name || '-')}</td>
                  <td>${escapeHtml(c.scheme_name || '-')}</td>
                  <td class="text-center text-xs text-gray-500">${formatDateOnly(c.period_start)} ~ ${formatDateOnly(c.period_end)}</td>
                  <td class="text-right font-mono">${formatCurrency(c.valid_bet || 0)}</td>
                  <td class="text-right font-mono text-purple-600">${((c.commission_rate || 0) * 100).toFixed(2)}%</td>
                  <td class="text-right font-mono font-semibold text-emerald-600">${formatCurrency(c.commission_amount || 0)}</td>
                  <td class="text-center">${getStatusBadge(c.status, 'commission')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载转账记录
async function loadTransfersData() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  try {
    const result = await API.get('/transfers', { limit: 100 })
    const transfers = result.data || []
    const stats = result.stats || {}
    
    container.innerHTML = `
      <!-- 筛选器 -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-500">日期:</label>
          <input type="date" id="transferDateFrom" class="form-input form-input-sm" value="${weekAgo}">
          <span class="text-gray-400">至</span>
          <input type="date" id="transferDateTo" class="form-input form-input-sm" value="${today}">
        </div>
        <input type="text" id="transferFromSearch" class="form-input form-input-sm" placeholder="转出账号" style="width:100px;">
        <input type="text" id="transferToSearch" class="form-input form-input-sm" placeholder="转入账号" style="width:100px;">
        <button onclick="searchTransfers()" class="btn btn-primary btn-sm"><i class="fas fa-search mr-1"></i>查询</button>
        <button onclick="exportTransfers()" class="btn btn-success btn-sm"><i class="fas fa-download mr-1"></i>导出</button>
      </div>
      
      <!-- 统计卡片 -->
      <div class="grid grid-4 gap-md mb-6">
        <div class="text-center p-3 bg-blue-50 rounded-lg">
          <div class="text-2xl font-bold text-blue-600">${stats.total_count || transfers.length}</div>
          <div class="text-xs text-gray-500">转账笔数</div>
        </div>
        <div class="text-center p-3 bg-indigo-50 rounded-lg">
          <div class="text-2xl font-bold text-indigo-600">${formatCurrency(stats.total_amount || 0)}</div>
          <div class="text-xs text-gray-500">总转账额</div>
        </div>
        <div class="text-center p-3 bg-orange-50 rounded-lg">
          <div class="text-2xl font-bold text-orange-600">${formatCurrency(stats.total_fee || 0)}</div>
          <div class="text-xs text-gray-500">手续费收入</div>
        </div>
        <div class="text-center p-3 bg-emerald-50 rounded-lg">
          <div class="text-2xl font-bold text-emerald-600">${formatCurrency(stats.total_actual || 0)}</div>
          <div class="text-xs text-gray-500">实际到账</div>
        </div>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>转账单号</th>
              <th>转出账号</th>
              <th>转入账号</th>
              <th class="text-right">转账金额</th>
              <th class="text-right">手续费</th>
              <th class="text-right">实际到账</th>
              <th class="text-center">状态</th>
              <th>时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.length === 0 ? `<tr><td colspan="9">${showEmpty('exchange-alt', '暂无转账记录')}</td></tr>` :
              transfers.map(t => `
                <tr>
                  <td class="font-mono text-xs text-gray-500">${escapeHtml(t.transfer_no || '-')}</td>
                  <td class="font-semibold">${escapeHtml(t.from_username || '-')}</td>
                  <td class="font-semibold">${escapeHtml(t.to_username || '-')}</td>
                  <td class="text-right font-mono text-blue-600">${formatCurrency(t.amount || 0)}</td>
                  <td class="text-right font-mono text-orange-600">${formatCurrency(t.fee || 0)}</td>
                  <td class="text-right font-mono text-emerald-600">${formatCurrency(t.actual_amount || 0)}</td>
                  <td class="text-center">
                    <span class="badge ${t.status === 1 ? 'badge-success' : t.status === 2 ? 'badge-danger' : 'badge-warning'}">
                      ${t.status === 1 ? '成功' : t.status === 2 ? '失败' : '处理中'}
                    </span>
                  </td>
                  <td class="text-xs text-gray-500">${formatShortDate(t.created_at)}</td>
                  <td class="text-center">
                    <button onclick="viewTransferDetail(${t.id})" class="btn btn-primary btn-xs">详情</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 加载手续费设置
async function loadFeeSettingsData() {
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/transfers/fee-settings')
    const settings = result.data || []
    
    container.innerHTML = `
      <!-- 操作按钮 -->
      <div class="flex items-center gap-4 mb-4">
        <button onclick="showAddFeeSettingModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i> 新增配置
        </button>
        <span class="text-sm text-gray-500">配置转账手续费规则，支持按金额区间设置固定或百分比费率</span>
      </div>
      
      <!-- 表格 -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>配置名称</th>
              <th class="text-right">最小金额</th>
              <th class="text-right">最大金额</th>
              <th class="text-center">费率类型</th>
              <th class="text-right">费率值</th>
              <th class="text-right">最低手续费</th>
              <th class="text-right">最高手续费</th>
              <th class="text-center">优先级</th>
              <th class="text-center">状态</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${settings.length === 0 ? `<tr><td colspan="10">${showEmpty('cog', '暂无手续费配置')}</td></tr>` :
              settings.map(s => `
                <tr>
                  <td class="font-semibold">${escapeHtml(s.name || '-')}</td>
                  <td class="text-right font-mono">${formatCurrency(s.min_amount || 0)}</td>
                  <td class="text-right font-mono">${s.max_amount ? formatCurrency(s.max_amount) : '无上限'}</td>
                  <td class="text-center">
                    <span class="badge ${s.fee_type === 'fixed' ? 'badge-info' : 'badge-purple'}">
                      ${s.fee_type === 'fixed' ? '固定金额' : '百分比'}
                    </span>
                  </td>
                  <td class="text-right font-mono font-semibold">
                    ${s.fee_type === 'fixed' ? formatCurrency(s.fee_value || 0) : ((s.fee_value || 0) * 100).toFixed(2) + '%'}
                  </td>
                  <td class="text-right font-mono">${s.min_fee ? formatCurrency(s.min_fee) : '-'}</td>
                  <td class="text-right font-mono">${s.max_fee ? formatCurrency(s.max_fee) : '-'}</td>
                  <td class="text-center">${s.priority || 0}</td>
                  <td class="text-center">
                    <span class="badge ${s.is_enabled ? 'badge-success' : 'badge-gray'} cursor-pointer" 
                          onclick="toggleFeeSetting(${s.id}, ${s.is_enabled ? 0 : 1})">
                      ${s.is_enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <button onclick="editFeeSetting(${s.id})" class="btn btn-primary btn-xs">编辑</button>
                      <button onclick="deleteFeeSetting(${s.id}, '${escapeHtml(s.name || '')}')" class="btn btn-danger btn-xs">删除</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- 费率计算测试 -->
      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 class="font-semibold mb-3">手续费计算测试</h4>
        <div class="flex items-center gap-4">
          <input type="number" id="testFeeAmount" class="form-input form-input-sm" placeholder="输入转账金额" style="width:150px;">
          <button onclick="testFeeCalculation()" class="btn btn-primary btn-sm">计算手续费</button>
          <div id="feeCalculationResult" class="text-sm text-gray-600"></div>
        </div>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 显示新增手续费配置弹窗
function showAddFeeSettingModal() {
  const content = `
    <form onsubmit="submitAddFeeSetting(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group col-span-2">
          <label class="form-label">配置名称 *</label>
          <input type="text" id="feeSettingName" class="form-input" required placeholder="如：小额转账免手续费">
        </div>
        <div class="form-group">
          <label class="form-label">最小金额</label>
          <input type="number" id="feeSettingMinAmount" class="form-input" value="0" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">最大金额 (留空表示无上限)</label>
          <input type="number" id="feeSettingMaxAmount" class="form-input" placeholder="无上限">
        </div>
        <div class="form-group">
          <label class="form-label">费率类型 *</label>
          <select id="feeSettingType" class="form-select" required>
            <option value="fixed">固定金额</option>
            <option value="percent">百分比</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">费率值 *</label>
          <input type="number" id="feeSettingValue" class="form-input" step="0.001" required placeholder="固定金额或百分比(如0.005表示0.5%)">
        </div>
        <div class="form-group">
          <label class="form-label">最低手续费</label>
          <input type="number" id="feeSettingMinFee" class="form-input" min="0" placeholder="可选">
        </div>
        <div class="form-group">
          <label class="form-label">最高手续费</label>
          <input type="number" id="feeSettingMaxFee" class="form-input" min="0" placeholder="可选">
        </div>
        <div class="form-group">
          <label class="form-label">优先级 (数字越大优先级越高)</label>
          <input type="number" id="feeSettingPriority" class="form-input" value="100">
        </div>
        <div class="form-group">
          <label class="form-label">描述说明</label>
          <input type="text" id="feeSettingDesc" class="form-input" placeholder="可选">
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">保存</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增手续费配置', content, { width: '600px' })
}

// 提交新增手续费配置
async function submitAddFeeSetting(e) {
  e.preventDefault()
  
  const data = {
    name: document.getElementById('feeSettingName').value,
    min_amount: parseFloat(document.getElementById('feeSettingMinAmount').value) || 0,
    max_amount: document.getElementById('feeSettingMaxAmount').value ? parseFloat(document.getElementById('feeSettingMaxAmount').value) : null,
    fee_type: document.getElementById('feeSettingType').value,
    fee_value: parseFloat(document.getElementById('feeSettingValue').value),
    min_fee: document.getElementById('feeSettingMinFee').value ? parseFloat(document.getElementById('feeSettingMinFee').value) : null,
    max_fee: document.getElementById('feeSettingMaxFee').value ? parseFloat(document.getElementById('feeSettingMaxFee').value) : null,
    priority: parseInt(document.getElementById('feeSettingPriority').value) || 100,
    description: document.getElementById('feeSettingDesc').value || ''
  }
  
  try {
    await API.post('/transfers/fee-settings', data)
    showNotification('手续费配置添加成功', 'success')
    closeAllModals()
    loadFeeSettingsData()
  } catch (error) {
    showNotification('添加失败: ' + error.message, 'danger')
  }
}

// 编辑手续费配置
async function editFeeSetting(id) {
  try {
    const result = await API.get('/transfers/fee-settings')
    const setting = result.data.find(s => s.id === id)
    if (!setting) {
      showNotification('配置不存在', 'danger')
      return
    }
    
    const content = `
      <form onsubmit="submitEditFeeSetting(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group col-span-2">
            <label class="form-label">配置名称 *</label>
            <input type="text" id="editFeeSettingName" class="form-input" required value="${escapeHtml(setting.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">最小金额</label>
            <input type="number" id="editFeeSettingMinAmount" class="form-input" value="${setting.min_amount || 0}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">最大金额</label>
            <input type="number" id="editFeeSettingMaxAmount" class="form-input" value="${setting.max_amount || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">费率类型 *</label>
            <select id="editFeeSettingType" class="form-select" required>
              <option value="fixed" ${setting.fee_type === 'fixed' ? 'selected' : ''}>固定金额</option>
              <option value="percent" ${setting.fee_type === 'percent' ? 'selected' : ''}>百分比</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">费率值 *</label>
            <input type="number" id="editFeeSettingValue" class="form-input" step="0.001" required value="${setting.fee_value || 0}">
          </div>
          <div class="form-group">
            <label class="form-label">最低手续费</label>
            <input type="number" id="editFeeSettingMinFee" class="form-input" min="0" value="${setting.min_fee || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">最高手续费</label>
            <input type="number" id="editFeeSettingMaxFee" class="form-input" min="0" value="${setting.max_fee || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">优先级</label>
            <input type="number" id="editFeeSettingPriority" class="form-input" value="${setting.priority || 100}">
          </div>
          <div class="form-group">
            <label class="form-label">描述说明</label>
            <input type="text" id="editFeeSettingDesc" class="form-input" value="${escapeHtml(setting.description || '')}">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑手续费配置', content, { width: '600px' })
  } catch (error) {
    showNotification('获取配置失败: ' + error.message, 'danger')
  }
}

// 提交编辑手续费配置
async function submitEditFeeSetting(e, id) {
  e.preventDefault()
  
  const data = {
    name: document.getElementById('editFeeSettingName').value,
    min_amount: parseFloat(document.getElementById('editFeeSettingMinAmount').value) || 0,
    max_amount: document.getElementById('editFeeSettingMaxAmount').value ? parseFloat(document.getElementById('editFeeSettingMaxAmount').value) : null,
    fee_type: document.getElementById('editFeeSettingType').value,
    fee_value: parseFloat(document.getElementById('editFeeSettingValue').value),
    min_fee: document.getElementById('editFeeSettingMinFee').value ? parseFloat(document.getElementById('editFeeSettingMinFee').value) : null,
    max_fee: document.getElementById('editFeeSettingMaxFee').value ? parseFloat(document.getElementById('editFeeSettingMaxFee').value) : null,
    priority: parseInt(document.getElementById('editFeeSettingPriority').value) || 100,
    description: document.getElementById('editFeeSettingDesc').value || ''
  }
  
  try {
    await API.put(`/transfers/fee-settings/${id}`, data)
    showNotification('手续费配置更新成功', 'success')
    closeAllModals()
    loadFeeSettingsData()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

// 切换手续费配置状态
async function toggleFeeSetting(id, newStatus) {
  try {
    await API.post(`/transfers/fee-settings/${id}/toggle`, { is_enabled: newStatus })
    showNotification(newStatus ? '配置已启用' : '配置已禁用', 'success')
    loadFeeSettingsData()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

// 删除手续费配置
async function deleteFeeSetting(id, name) {
  if (!confirm(`确定要删除手续费配置「${name}」吗？此操作不可恢复。`)) return
  
  try {
    await API.delete(`/transfers/fee-settings/${id}`)
    showNotification('配置已删除', 'success')
    loadFeeSettingsData()
  } catch (error) {
    showNotification('删除失败: ' + error.message, 'danger')
  }
}

// 测试手续费计算
async function testFeeCalculation() {
  const amount = document.getElementById('testFeeAmount')?.value
  if (!amount) {
    showNotification('请输入转账金额', 'warning')
    return
  }
  
  try {
    const result = await API.get('/transfers/calculate-fee', { amount })
    const resultDiv = document.getElementById('feeCalculationResult')
    if (result.data) {
      resultDiv.innerHTML = `
        <span class="text-green-600">
          转账 <strong>${formatCurrency(amount)}</strong> → 
          手续费: <strong class="text-orange-600">${formatCurrency(result.data.fee)}</strong>，
          实际到账: <strong class="text-emerald-600">${formatCurrency(result.data.actual_amount)}</strong>
          ${result.data.rule_name ? `<span class="text-gray-400 text-xs ml-2">(规则: ${result.data.rule_name})</span>` : ''}
        </span>
      `
    }
  } catch (error) {
    showNotification('计算失败: ' + error.message, 'danger')
  }
}

// ============================================
// 报表搜索与导出函数
// ============================================

// 导出日报表
async function exportDailyReport() {
  const dateFrom = document.getElementById('dailyReportDate')?.value || ''
  const dateTo = dateFrom
  
  try {
    showNotification('正在导出日报表...', 'info')
    const result = await API.get('/exports/daily', { date_from: dateFrom, date_to: dateTo })
    downloadCSV(result.data, `日报表_${dateFrom}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出股东报表
async function searchShareholderReport() {
  const dateFrom = document.getElementById('shDateFrom')?.value || ''
  const dateTo = document.getElementById('shDateTo')?.value || ''
  loadShareholderReport()
}

async function exportShareholderReport() {
  const dateFrom = document.getElementById('shDateFrom')?.value || ''
  const dateTo = document.getElementById('shDateTo')?.value || ''
  
  try {
    showNotification('正在导出股东报表...', 'info')
    const result = await API.get('/reports/shareholder', { date_from: dateFrom, date_to: dateTo })
    const exportData = (result.data?.shareholders || []).map(s => ({
      '股东账号': s.shareholder_name,
      '直属会员': s.total_players,
      '下级代理': s.sub_agent_count,
      '总投注额': s.total_bet,
      '有效投注': s.valid_bet,
      '会员盈利': s.player_win,
      '会员亏损': s.player_loss,
      '公司盈利': s.company_profit,
      '预计佣金': s.commission
    }))
    downloadCSV(exportData, `股东报表_${dateFrom}_${dateTo}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出代理报表
async function searchAgentReport() {
  loadAgentReport()
}

async function exportAgentReport() {
  const dateFrom = document.getElementById('agentDateFrom')?.value || ''
  const dateTo = document.getElementById('agentDateTo')?.value || ''
  
  try {
    showNotification('正在导出代理报表...', 'info')
    const result = await API.get('/exports/agents', { date_from: dateFrom, date_to: dateTo })
    downloadCSV(result.data, `代理报表_${dateFrom}_${dateTo}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出会员报表
async function searchPlayerReport(e) {
  if (e) e.preventDefault()
  
  const container = document.getElementById('reportContent')
  if (!container) return
  
  const params = {
    limit: 100
  }
  
  const username = document.getElementById('playerUsernameSearch')?.value
  const playerId = document.getElementById('playerIdSearch')?.value
  const agentId = document.getElementById('playerAgentIdSearch')?.value
  const minBet = document.getElementById('playerMinBet')?.value
  const dateFrom = document.getElementById('playerDateFrom')?.value
  const dateTo = document.getElementById('playerDateTo')?.value
  
  if (username) params.username = username
  if (playerId) params.player_id = playerId
  if (agentId) params.agent_id = agentId
  if (minBet) params.min_bet = minBet
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  
  try {
    const result = await API.get('/reports/players', params)
    const players = result.data || []
    
    // 只更新表格部分，保留查询表单
    const tableContainer = container.querySelector('.data-table-wrapper')
    if (tableContainer) {
      tableContainer.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>会员账号</th>
              <th>代理</th>
              <th class="text-center">VIP</th>
              <th class="text-right">投注笔数</th>
              <th class="text-right">总投注额</th>
              <th class="text-right">有效投注</th>
              <th class="text-right">会员盈利</th>
              <th class="text-right">会员亏损</th>
              <th class="text-right">净盈亏</th>
              <th class="text-right">总充值</th>
              <th class="text-right">总提款</th>
            </tr>
          </thead>
          <tbody>
            ${players.length === 0 ? `<tr><td colspan="11">${showEmpty('user', '暂无会员数据')}</td></tr>` :
              players.map(p => `
                <tr>
                  <td class="font-semibold">${escapeHtml(p.username || '-')}</td>
                  <td class="text-gray-600 text-sm">${escapeHtml(p.agent_name || '-')}</td>
                  <td class="text-center"><span class="badge badge-warning">VIP${p.vip_level || 0}</span></td>
                  <td class="text-right">${p.bet_count || 0}</td>
                  <td class="text-right font-mono">${formatCurrency(p.total_bet || 0)}</td>
                  <td class="text-right font-mono">${formatCurrency(p.valid_bet || 0)}</td>
                  <td class="text-right font-mono text-emerald-600">${formatCurrency(p.player_win || 0)}</td>
                  <td class="text-right font-mono text-red-600">${formatCurrency(p.player_loss || 0)}</td>
                  <td class="text-right font-mono font-semibold ${(p.net_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatCurrency(p.net_profit || 0)}
                  </td>
                  <td class="text-right font-mono text-blue-600">${formatCurrency(p.total_deposit || 0)}</td>
                  <td class="text-right font-mono text-orange-600">${formatCurrency(p.total_withdrawal || 0)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      `
    }
  } catch (error) {
    showNotification('查询失败: ' + error.message, 'danger')
  }
}

// 重置会员报表筛选
function resetPlayerReportFilter() {
  document.getElementById('playerReportSearchForm')?.reset()
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  document.getElementById('playerDateFrom').value = monthAgo
  document.getElementById('playerDateTo').value = today
  loadPlayerReport()
}

async function exportPlayerReport() {
  const dateFrom = document.getElementById('playerDateFrom')?.value || ''
  const dateTo = document.getElementById('playerDateTo')?.value || ''
  
  try {
    showNotification('正在导出会员报表...', 'info')
    const result = await API.get('/exports/players', { date_from: dateFrom, date_to: dateTo })
    downloadCSV(result.data, `会员报表_${dateFrom}_${dateTo}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出游戏报表
async function searchGameReport() {
  loadGameReport()
}

async function exportGameReport() {
  const dateFrom = document.getElementById('gameDateFrom')?.value || ''
  const dateTo = document.getElementById('gameDateTo')?.value || ''
  const gameType = document.getElementById('gameTypeSelect')?.value || ''
  
  try {
    showNotification('正在导出游戏报表...', 'info')
    const params = { date_from: dateFrom, date_to: dateTo }
    if (gameType) params.game_type = gameType
    const result = await API.get('/reports/games', params)
    const exportData = (result.data?.byGame || []).map(g => ({
      '游戏类型': getGameTypeName(g.game_type),
      '投注笔数': g.bet_count,
      '参与人数': g.player_count,
      '总投注额': g.total_bet,
      '有效投注': g.valid_bet,
      '总派彩': g.total_payout,
      '公司盈利': g.company_profit,
      '平均投注': g.avg_bet,
      '最大单注': g.max_bet
    }))
    downloadCSV(exportData, `游戏报表_${dateFrom}_${dateTo}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出佣金报表
async function searchCommissionReport() {
  loadCommissionReport()
}

async function exportCommissionReport() {
  const dateFrom = document.getElementById('commDateFrom')?.value || ''
  const dateTo = document.getElementById('commDateTo')?.value || ''
  const status = document.getElementById('commStatusFilter')?.value || ''
  
  try {
    showNotification('正在导出佣金报表...', 'info')
    const params = { date_from: dateFrom, date_to: dateTo }
    if (status) params.status = status
    const result = await API.get('/exports/commission', params)
    downloadCSV(result.data, `佣金报表_${dateFrom}_${dateTo}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 搜索/导出转账记录
async function searchTransfers() {
  const dateFrom = document.getElementById('transferDateFrom')?.value || ''
  const dateTo = document.getElementById('transferDateTo')?.value || ''
  const fromUsername = document.getElementById('transferFromSearch')?.value || ''
  const toUsername = document.getElementById('transferToSearch')?.value || ''
  
  const container = document.getElementById('reportContent')
  container.innerHTML = showLoading()
  
  try {
    const params = { limit: 200 }
    if (dateFrom) params.start_date = dateFrom
    if (dateTo) params.end_date = dateTo
    if (fromUsername) params.from_username = fromUsername
    if (toUsername) params.to_username = toUsername
    
    const result = await API.get('/transfers', params)
    // 重新加载转账数据
    loadTransfersData()
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '查询失败: ' + error.message)
  }
}

async function exportTransfers() {
  const dateFrom = document.getElementById('transferDateFrom')?.value || ''
  const dateTo = document.getElementById('transferDateTo')?.value || ''
  const fromUsername = document.getElementById('transferFromSearch')?.value || ''
  const toUsername = document.getElementById('transferToSearch')?.value || ''
  
  try {
    showNotification('正在导出转账记录...', 'info')
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (fromUsername) params.from_username = fromUsername
    if (toUsername) params.to_username = toUsername
    
    const result = await API.get('/exports/transfers', params)
    downloadCSV(result.data, `转账记录_${dateFrom || 'all'}_${dateTo || 'all'}.csv`)
    showNotification('导出成功', 'success')
  } catch (error) {
    showNotification('导出失败: ' + error.message, 'danger')
  }
}

// 查看转账详情
async function viewTransferDetail(id) {
  try {
    const result = await API.get(`/transfers/${id}`)
    const t = result.data
    
    const content = `
      <div class="space-y-4">
        <!-- 基本信息 -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-semibold text-gray-700 mb-3">
            <i class="fas fa-exchange-alt mr-2 text-blue-500"></i>转账信息
          </h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">转账单号:</span>
              <span class="font-mono ml-2">${escapeHtml(t.transfer_no || '-')}</span>
            </div>
            <div>
              <span class="text-gray-500">转账时间:</span>
              <span class="ml-2">${formatDateTime(t.created_at)}</span>
            </div>
            <div>
              <span class="text-gray-500">转账状态:</span>
              <span class="ml-2 badge ${t.status === 1 ? 'badge-success' : t.status === 2 ? 'badge-danger' : 'badge-warning'}">
                ${t.status === 1 ? '成功' : t.status === 2 ? '失败' : '处理中'}
              </span>
            </div>
            <div>
              <span class="text-gray-500">备注:</span>
              <span class="ml-2">${escapeHtml(t.remark || '-')}</span>
            </div>
          </div>
        </div>
        
        <!-- 发送方信息 -->
        <div class="bg-blue-50 rounded-lg p-4">
          <h4 class="font-semibold text-blue-700 mb-3">
            <i class="fas fa-user mr-2"></i>发送方信息
          </h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">发送账号:</span>
              <span class="font-semibold ml-2 text-blue-600">${escapeHtml(t.from_username || '-')}</span>
            </div>
            <div>
              <span class="text-gray-500">发送方IP:</span>
              <span class="font-mono ml-2">${escapeHtml(t.ip_address || '-')}</span>
            </div>
            <div>
              <span class="text-gray-500">转账前余额:</span>
              <span class="font-mono ml-2">${formatCurrency(t.from_balance_before || 0)}</span>
            </div>
            <div>
              <span class="text-gray-500">转账后余额:</span>
              <span class="font-mono ml-2">${formatCurrency(t.from_balance_after || 0)}</span>
            </div>
          </div>
        </div>
        
        <!-- 接收方信息 -->
        <div class="bg-green-50 rounded-lg p-4">
          <h4 class="font-semibold text-green-700 mb-3">
            <i class="fas fa-user-check mr-2"></i>接收方信息
          </h4>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">接收账号:</span>
              <span class="font-semibold ml-2 text-green-600">${escapeHtml(t.to_username || '-')}</span>
            </div>
            <div>
              <span class="text-gray-500">接收方IP:</span>
              <span class="font-mono ml-2">${escapeHtml(t.to_ip_address || '-')}</span>
            </div>
            <div>
              <span class="text-gray-500">转账前余额:</span>
              <span class="font-mono ml-2">${formatCurrency(t.to_balance_before || 0)}</span>
            </div>
            <div>
              <span class="text-gray-500">转账后余额:</span>
              <span class="font-mono ml-2">${formatCurrency(t.to_balance_after || 0)}</span>
            </div>
          </div>
        </div>
        
        <!-- 金额信息 -->
        <div class="bg-orange-50 rounded-lg p-4">
          <h4 class="font-semibold text-orange-700 mb-3">
            <i class="fas fa-money-bill-wave mr-2"></i>金额明细
          </h4>
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-blue-600">${formatCurrency(t.amount || 0)}</div>
              <div class="text-xs text-gray-500 mt-1">转账金额</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-orange-600">${formatCurrency(t.fee || 0)}</div>
              <div class="text-xs text-gray-500 mt-1">手续费</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">${formatCurrency(t.actual_amount || 0)}</div>
              <div class="text-xs text-gray-500 mt-1">实际到账</div>
            </div>
          </div>
        </div>
        
        <!-- 设备信息 -->
        ${t.device_info ? `
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-semibold text-gray-700 mb-3">
            <i class="fas fa-laptop mr-2"></i>设备信息
          </h4>
          <div class="text-sm text-gray-600">
            ${escapeHtml(t.device_info)}
          </div>
        </div>
        ` : ''}
      </div>
    `
    
    showModal('转账详情', content, { width: '650px' })
  } catch (error) {
    showNotification('获取转账详情失败: ' + error.message, 'danger')
  }
}

// 通用CSV下载函数
function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    showNotification('没有可导出的数据', 'warning')
    return
  }
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }).join(','))
  ].join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function switchFinanceTab(tab) {
  // 更新标签状态
  const tabs = document.querySelectorAll('.tabs .tab')
  tabs.forEach((t, i) => {
    t.classList.remove('active')
    const tabNames = ['pending', 'deposits', 'withdrawals', 'transactions', 'payment-methods']
    if (tabNames[i] === tab) t.classList.add('active')
  })
  
  const container = document.getElementById('finance-content')
  if (!container) return
  
  container.innerHTML = showLoading()
  
  try {
    switch (tab) {
      case 'pending':
        const pendingData = await API.get('/withdrawals/pending')
        renderPendingWithdrawals(container, pendingData.data)
        break
      case 'deposits':
        renderDepositsQuery(container)
        break
      case 'withdrawals':
        renderWithdrawalsQuery(container)
        break
      case 'transactions':
        renderTransactionsQuery(container)
        break
      case 'payment-methods':
        await renderPaymentMethods(container)
        break
    }
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败')
  }
}

// 渲染待审核提款列表
function renderPendingWithdrawals(container, data) {
  container.innerHTML = data.length === 0 ? showEmpty('check-circle', '暂无待审核提款', '所有提款申请已处理完成') : `
    <div class="space-y-md">
      ${data.map(w => `
        <div class="info-card ${w.amount >= 20000 ? 'border-l-4 border-l-amber-500' : ''}">
          <div class="flex flex-col lg:flex-row lg:items-center gap-4">
            <div class="flex-1">
              <div class="flex items-center flex-wrap gap-3 mb-3">
                <span class="text-lg font-semibold">${escapeHtml(w.username || '')}</span>
                <span class="text-sm text-gray-400 font-mono">${w.order_no}</span>
              </div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div><div class="text-gray-400 mb-1">提款金额</div><div class="text-xl font-semibold text-red-600">${formatCurrency(w.amount)}</div></div>
                <div><div class="text-gray-400 mb-1">银行</div><div class="font-medium">${escapeHtml(w.bank_name || '-')}</div></div>
                <div><div class="text-gray-400 mb-1">账号</div><div class="font-mono">${escapeHtml(w.bank_account || '-')}</div></div>
                <div><div class="text-gray-400 mb-1">申请时间</div><div>${formatShortDate(w.created_at)}</div></div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="reviewWithdrawal(${w.id}, 'approve')" class="btn btn-success btn-sm"><i class="fas fa-check"></i> 通过</button>
              <button onclick="reviewWithdrawal(${w.id}, 'reject')" class="btn btn-danger btn-sm"><i class="fas fa-times"></i> 拒绝</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

// 渲染存款查询页面
async function renderDepositsQuery(container) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  container.innerHTML = `
    <!-- 查询表单 -->
    <div class="bg-gray-50 p-4 rounded-lg mb-4">
      <form id="depositsSearchForm" onsubmit="searchDeposits(event)">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">订单号</label>
            <input type="text" id="depositOrderNo" class="form-input form-input-sm" placeholder="输入订单号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员账号</label>
            <input type="text" id="depositUsername" class="form-input form-input-sm" placeholder="输入会员账号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">状态</label>
            <select id="depositStatus" class="form-select form-input-sm">
              <option value="">全部状态</option>
              <option value="0">待审核</option>
              <option value="1">已完成</option>
              <option value="2">已拒绝</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员ID</label>
            <input type="number" id="depositPlayerId" class="form-input form-input-sm" placeholder="输入会员ID">
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">开始日期</label>
            <input type="date" id="depositDateFrom" class="form-input form-input-sm" value="${weekAgo}">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">结束日期</label>
            <input type="date" id="depositDateTo" class="form-input form-input-sm" value="${today}">
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <button type="submit" class="btn btn-primary btn-sm">
              <i class="fas fa-search mr-1"></i>查询
            </button>
            <button type="button" onclick="resetDepositsFilter()" class="btn btn-secondary btn-sm">
              <i class="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </form>
    </div>
    
    <!-- 数据表格 -->
    <div id="depositsTableContainer">
      ${showLoading()}
    </div>
  `
  
  // 初始加载
  loadDepositsData()
}

// 加载存款数据
async function loadDepositsData(params = {}) {
  const container = document.getElementById('depositsTableContainer')
  if (!container) return
  
  try {
    const data = await API.get('/deposits', { limit: 100, ...params })
    container.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>会员ID</th>
              <th>玩家账号</th>
              <th class="text-right">金额</th>
              <th>支付方式</th>
              <th class="text-center">状态</th>
              <th>申请时间</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.length === 0 ? `<tr><td colspan="7">${showEmpty('inbox', '暂无存款记录')}</td></tr>` :
              data.data.map(d => `
                <tr>
                  <td class="font-mono text-sm">${d.order_no}</td>
                  <td class="font-mono text-gray-500">${d.player_id || '-'}</td>
                  <td class="font-semibold">${escapeHtml(d.username || '-')}</td>
                  <td class="text-right font-mono text-emerald-600 font-semibold text-lg">${formatCurrency(d.amount)}</td>
                  <td>${escapeHtml(d.payment_method || '-')}</td>
                  <td class="text-center">${getStatusBadge(d.status, 'deposit')}</td>
                  <td class="text-gray-500 text-sm">${formatShortDate(d.created_at)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败')
  }
}

// 搜索存款
function searchDeposits(e) {
  e.preventDefault()
  const params = {}
  
  const orderNo = document.getElementById('depositOrderNo')?.value
  const username = document.getElementById('depositUsername')?.value
  const status = document.getElementById('depositStatus')?.value
  const playerId = document.getElementById('depositPlayerId')?.value
  const dateFrom = document.getElementById('depositDateFrom')?.value
  const dateTo = document.getElementById('depositDateTo')?.value
  
  if (orderNo) params.order_no = orderNo
  if (username) params.username = username
  if (status) params.status = status
  if (playerId) params.player_id = playerId
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  
  loadDepositsData(params)
}

// 重置存款筛选
function resetDepositsFilter() {
  document.getElementById('depositsSearchForm')?.reset()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  document.getElementById('depositDateFrom').value = weekAgo
  document.getElementById('depositDateTo').value = today
  loadDepositsData()
}

// 渲染提款查询页面
async function renderWithdrawalsQuery(container) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  container.innerHTML = `
    <!-- 查询表单 -->
    <div class="bg-gray-50 p-4 rounded-lg mb-4">
      <form id="withdrawalsSearchForm" onsubmit="searchWithdrawals(event)">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">订单号</label>
            <input type="text" id="withdrawalOrderNo" class="form-input form-input-sm" placeholder="输入订单号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员账号</label>
            <input type="text" id="withdrawalUsername" class="form-input form-input-sm" placeholder="输入会员账号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">状态</label>
            <select id="withdrawalStatus" class="form-select form-input-sm">
              <option value="">全部状态</option>
              <option value="0">待审核</option>
              <option value="1">已批准</option>
              <option value="2">已拒绝</option>
              <option value="3">处理中</option>
              <option value="4">已完成</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员ID</label>
            <input type="number" id="withdrawalPlayerId" class="form-input form-input-sm" placeholder="输入会员ID">
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">开始日期</label>
            <input type="date" id="withdrawalDateFrom" class="form-input form-input-sm" value="${weekAgo}">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">结束日期</label>
            <input type="date" id="withdrawalDateTo" class="form-input form-input-sm" value="${today}">
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <button type="submit" class="btn btn-primary btn-sm">
              <i class="fas fa-search mr-1"></i>查询
            </button>
            <button type="button" onclick="resetWithdrawalsFilter()" class="btn btn-secondary btn-sm">
              <i class="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </form>
    </div>
    
    <!-- 数据表格 -->
    <div id="withdrawalsTableContainer">
      ${showLoading()}
    </div>
  `
  
  loadWithdrawalsData()
}

// 加载提款数据
async function loadWithdrawalsData(params = {}) {
  const container = document.getElementById('withdrawalsTableContainer')
  if (!container) return
  
  try {
    const data = await API.get('/withdrawals', { limit: 100, ...params })
    container.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>会员ID</th>
              <th>玩家账号</th>
              <th class="text-right">金额</th>
              <th>银行</th>
              <th>账号</th>
              <th class="text-center">状态</th>
              <th>申请时间</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.length === 0 ? `<tr><td colspan="8">${showEmpty('inbox', '暂无提款记录')}</td></tr>` :
              data.data.map(w => `
                <tr>
                  <td class="font-mono text-sm">${w.order_no}</td>
                  <td class="font-mono text-gray-500">${w.player_id || '-'}</td>
                  <td class="font-semibold">${escapeHtml(w.username || '-')}</td>
                  <td class="text-right font-mono text-red-600 font-semibold text-lg">${formatCurrency(w.amount)}</td>
                  <td>${escapeHtml(w.bank_name || '-')}</td>
                  <td class="font-mono text-sm">${escapeHtml(w.bank_account || '-')}</td>
                  <td class="text-center">${getStatusBadge(w.status, 'withdrawal')}</td>
                  <td class="text-gray-500 text-sm">${formatShortDate(w.created_at)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败')
  }
}

// 搜索提款
function searchWithdrawals(e) {
  e.preventDefault()
  const params = {}
  
  const orderNo = document.getElementById('withdrawalOrderNo')?.value
  const username = document.getElementById('withdrawalUsername')?.value
  const status = document.getElementById('withdrawalStatus')?.value
  const playerId = document.getElementById('withdrawalPlayerId')?.value
  const dateFrom = document.getElementById('withdrawalDateFrom')?.value
  const dateTo = document.getElementById('withdrawalDateTo')?.value
  
  if (orderNo) params.order_no = orderNo
  if (username) params.username = username
  if (status) params.status = status
  if (playerId) params.player_id = playerId
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  
  loadWithdrawalsData(params)
}

// 重置提款筛选
function resetWithdrawalsFilter() {
  document.getElementById('withdrawalsSearchForm')?.reset()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  document.getElementById('withdrawalDateFrom').value = weekAgo
  document.getElementById('withdrawalDateTo').value = today
  loadWithdrawalsData()
}

// 渲染资金流水查询页面
async function renderTransactionsQuery(container) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  container.innerHTML = `
    <!-- 查询表单 -->
    <div class="bg-gray-50 p-4 rounded-lg mb-4">
      <form id="transactionsSearchForm" onsubmit="searchTransactions(event)">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">订单号</label>
            <input type="text" id="transactionOrderNo" class="form-input form-input-sm" placeholder="输入订单号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员账号</label>
            <input type="text" id="transactionUsername" class="form-input form-input-sm" placeholder="输入会员账号">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">流水类型</label>
            <select id="transactionType" class="form-select form-input-sm">
              <option value="">全部类型</option>
              <option value="deposit">存款</option>
              <option value="withdrawal">提款</option>
              <option value="bet">投注</option>
              <option value="payout">派彩</option>
              <option value="commission">洗码</option>
              <option value="bonus">红利</option>
              <option value="adjustment">调账</option>
              <option value="transfer_in">转入</option>
              <option value="transfer_out">转出</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">会员ID</label>
            <input type="number" id="transactionPlayerId" class="form-input form-input-sm" placeholder="输入会员ID">
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">开始日期</label>
            <input type="date" id="transactionDateFrom" class="form-input form-input-sm" value="${weekAgo}">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">结束日期</label>
            <input type="date" id="transactionDateTo" class="form-input form-input-sm" value="${today}">
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <button type="submit" class="btn btn-primary btn-sm">
              <i class="fas fa-search mr-1"></i>查询
            </button>
            <button type="button" onclick="resetTransactionsFilter()" class="btn btn-secondary btn-sm">
              <i class="fas fa-undo mr-1"></i>重置
            </button>
          </div>
        </div>
      </form>
    </div>
    
    <!-- 数据表格 -->
    <div id="transactionsTableContainer">
      ${showLoading()}
    </div>
  `
  
  loadTransactionsData()
}

// 加载资金流水数据
async function loadTransactionsData(params = {}) {
  const container = document.getElementById('transactionsTableContainer')
  if (!container) return
  
  try {
    const data = await API.get('/transactions', { limit: 100, ...params })
    container.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>会员ID</th>
              <th>玩家账号</th>
              <th>类型</th>
              <th class="text-right">金额变动</th>
              <th class="text-right">变动后余额</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.length === 0 ? `<tr><td colspan="7">${showEmpty('inbox', '暂无流水记录')}</td></tr>` :
              data.data.map(t => `
                <tr>
                  <td class="font-mono text-sm">${t.order_no || '-'}</td>
                  <td class="font-mono text-gray-500">${t.player_id || '-'}</td>
                  <td class="font-semibold">${escapeHtml(t.username || '-')}</td>
                  <td>${getTransactionTypeBadge(t.transaction_type)}</td>
                  <td class="text-right font-mono font-semibold text-lg ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}">${t.amount >= 0 ? '+' : ''}${formatCurrency(t.amount)}</td>
                  <td class="text-right font-mono">${formatCurrency(t.balance_after)}</td>
                  <td class="text-gray-500 text-sm">${formatShortDate(t.created_at)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败')
  }
}

// 搜索资金流水
function searchTransactions(e) {
  e.preventDefault()
  const params = {}
  
  const orderNo = document.getElementById('transactionOrderNo')?.value
  const username = document.getElementById('transactionUsername')?.value
  const type = document.getElementById('transactionType')?.value
  const playerId = document.getElementById('transactionPlayerId')?.value
  const dateFrom = document.getElementById('transactionDateFrom')?.value
  const dateTo = document.getElementById('transactionDateTo')?.value
  
  if (orderNo) params.order_no = orderNo
  if (username) params.username = username
  if (type) params.type = type
  if (playerId) params.player_id = playerId
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  
  loadTransactionsData(params)
}

// 重置资金流水筛选
function resetTransactionsFilter() {
  document.getElementById('transactionsSearchForm')?.reset()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  document.getElementById('transactionDateFrom').value = weekAgo
  document.getElementById('transactionDateTo').value = today
  loadTransactionsData()
}

function getTransactionTypeBadge(type) {
  const types = {
    deposit: { text: '存款', class: 'badge-success' },
    withdrawal: { text: '提款', class: 'badge-danger' },
    bet: { text: '投注', class: 'badge-warning' },
    payout: { text: '派彩', class: 'badge-info' },
    commission: { text: '洗码', class: 'badge-purple' },
    adjustment: { text: '调账', class: 'badge-secondary' }
  }
  const t = types[type] || { text: type, class: 'badge-secondary' }
  return `<span class="badge ${t.class}">${t.text}</span>`
}

// ============================================
// 收款方式管理功能
// ============================================

async function renderPaymentMethods(container) {
  const data = await API.get('/payment-methods', { include_stats: '1' })
  
  // 获取类型图标
  const getTypeIcon = (type) => {
    const icons = { crypto: 'fab fa-bitcoin', bank: 'fas fa-university', ewallet: 'fas fa-wallet' }
    return icons[type] || 'fas fa-credit-card'
  }
  
  // 获取类型名称
  const getTypeName = (type) => {
    const names = { crypto: '加密货币', bank: '银行卡', ewallet: '电子钱包' }
    return names[type] || type
  }
  
  // 获取货币图标
  const getCurrencyBadge = (currency) => {
    const badges = {
      CNY: 'badge-danger',
      USD: 'badge-success', 
      USDT: 'badge-info',
      BTC: 'badge-warning',
      PHP: 'badge-purple'
    }
    return `<span class="badge ${badges[currency] || 'badge-secondary'}">${currency}</span>`
  }
  
  container.innerHTML = `
    <!-- 统计卡片 -->
    <div class="grid grid-cols-5 gap-4 mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
      <div class="text-center">
        <div class="text-3xl font-bold text-green-600">${data.typeStats?.enabled || 0}</div>
        <div class="text-sm text-gray-500">启用中</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold text-gray-400">${data.typeStats?.disabled || 0}</div>
        <div class="text-sm text-gray-500">已禁用</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold text-amber-600">${data.typeStats?.crypto || 0}</div>
        <div class="text-sm text-gray-500">加密货币</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold text-blue-600">${data.typeStats?.bank || 0}</div>
        <div class="text-sm text-gray-500">银行卡</div>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold text-purple-600">${data.typeStats?.ewallet || 0}</div>
        <div class="text-sm text-gray-500">电子钱包</div>
      </div>
    </div>
    
    <!-- 操作栏 -->
    <div class="filter-bar mb-4">
      <select id="pmTypeFilter" class="form-select filter-select" onchange="filterPaymentMethods()">
        <option value="">全部类型</option>
        <option value="crypto">加密货币</option>
        <option value="bank">银行卡</option>
        <option value="ewallet">电子钱包</option>
      </select>
      <select id="pmStatusFilter" class="form-select filter-select" onchange="filterPaymentMethods()">
        <option value="">全部状态</option>
        <option value="1">启用</option>
        <option value="0">禁用</option>
      </select>
      <button onclick="showAddPaymentMethodModal()" class="btn btn-success btn-sm">
        <i class="fas fa-plus"></i> 新增收款方式
      </button>
    </div>
    
    <!-- 收款方式列表 -->
    <div class="grid grid-2 gap-md" id="paymentMethodsList">
      ${data.data.length === 0 ? `<div class="col-span-2">${showEmpty('credit-card', '暂无收款方式')}</div>` :
        data.data.map(pm => `
          <div class="info-card ${pm.status === 0 ? 'opacity-60' : ''} ${pm.is_default ? 'border-l-4 border-l-green-500' : ''}">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <i class="${getTypeIcon(pm.method_type)} text-xl text-gray-600"></i>
                </div>
                <div>
                  <div class="font-semibold text-lg flex items-center gap-2">
                    ${escapeHtml(pm.method_name)}
                    ${pm.is_default ? '<span class="badge badge-success text-xs">默认</span>' : ''}
                  </div>
                  <div class="text-sm text-gray-400">${escapeHtml(pm.method_code)}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${getCurrencyBadge(pm.currency)}
                <span class="badge ${pm.status === 1 ? 'badge-success' : 'badge-secondary'}">
                  ${pm.status === 1 ? '启用' : '禁用'}
                </span>
              </div>
            </div>
            
            <div class="grid grid-2 gap-3 text-sm mb-3">
              <div>
                <div class="text-gray-400">账户/地址</div>
                <div class="font-mono text-xs truncate" title="${escapeHtml(pm.account_number || '')}">${escapeHtml(pm.account_number || '-')}</div>
              </div>
              <div>
                <div class="text-gray-400">限额</div>
                <div class="font-semibold">${formatCurrency(pm.min_amount)} - ${formatCurrency(pm.max_amount)}</div>
              </div>
              ${pm.method_type === 'crypto' && pm.exchange_rate ? `
                <div>
                  <div class="text-gray-400">汇率</div>
                  <div class="font-semibold text-amber-600">1 ${pm.currency} = ¥${pm.exchange_rate}</div>
                </div>
              ` : ''}
              ${pm.fee_type !== 'none' ? `
                <div>
                  <div class="text-gray-400">手续费</div>
                  <div class="font-semibold text-red-500">${pm.fee_type === 'fixed' ? formatCurrency(pm.fee_value) : pm.fee_value + '%'}</div>
                </div>
              ` : ''}
            </div>
            
            ${pm.qr_code_url ? `
              <div class="mb-3 p-2 bg-gray-50 rounded flex items-center gap-3">
                <div class="w-12 h-12 bg-white rounded border flex items-center justify-center overflow-hidden">
                  <img src="${pm.qr_code_url}" alt="二维码" class="w-10 h-10 object-contain">
                </div>
                <div class="flex-1">
                  <div class="text-xs text-gray-500">收款二维码已设置</div>
                  <button onclick="showQRCodeModal('${escapeHtml(pm.method_name)}', '${pm.qr_code_url}')" class="text-xs text-indigo-600 hover:underline">
                    <i class="fas fa-expand mr-1"></i>查看大图
                  </button>
                </div>
              </div>
            ` : ''}
            
            ${pm.stats ? `
              <div class="text-xs text-gray-400 mb-3 p-2 bg-gray-50 rounded">
                30天统计: ${pm.stats.totalCount}笔 / ${formatCurrency(pm.stats.totalAmount)} / 成功率 ${pm.stats.successRate}%
              </div>
            ` : ''}
            
            <div class="flex gap-2 pt-3 border-t">
              <button onclick="editPaymentMethod(${pm.id})" class="btn btn-primary btn-xs flex-1">
                <i class="fas fa-edit"></i> 编辑
              </button>
              <button onclick="togglePaymentMethod(${pm.id})" class="btn ${pm.status === 1 ? 'btn-warning' : 'btn-success'} btn-xs flex-1">
                <i class="fas fa-${pm.status === 1 ? 'pause' : 'play'}"></i> ${pm.status === 1 ? '禁用' : '启用'}
              </button>
              ${!pm.is_default && pm.status === 1 ? `
                <button onclick="setDefaultPaymentMethod(${pm.id})" class="btn btn-info btn-xs" title="设为默认">
                  <i class="fas fa-star"></i>
                </button>
              ` : ''}
              <button onclick="deletePaymentMethod(${pm.id})" class="btn btn-danger btn-xs" title="删除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('')}
    </div>
  `
}

// 筛选收款方式
async function filterPaymentMethods() {
  const type = document.getElementById('pmTypeFilter')?.value || ''
  const status = document.getElementById('pmStatusFilter')?.value || ''
  const container = document.getElementById('finance-content')
  if (container) await renderPaymentMethods(container)
}

// 显示新增收款方式弹窗
function showAddPaymentMethodModal() {
  const content = `
    <form onsubmit="submitAddPaymentMethod(event)">
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">方式代码 *</label>
          <input type="text" id="pmCode" class="form-input" required placeholder="如: usdt_trc20">
        </div>
        <div class="form-group">
          <label class="form-label">显示名称 *</label>
          <input type="text" id="pmName" class="form-input" required placeholder="如: USDT-TRC20">
        </div>
      </div>
      
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">类型 *</label>
          <select id="pmType" class="form-select" required onchange="updatePaymentMethodForm()">
            <option value="">选择类型</option>
            <option value="crypto">加密货币</option>
            <option value="bank">银行卡</option>
            <option value="ewallet">电子钱包</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">货币</label>
          <select id="pmCurrency" class="form-select">
            <option value="CNY">CNY (人民币)</option>
            <option value="USDT">USDT</option>
            <option value="USD">USD (美元)</option>
            <option value="BTC">BTC (比特币)</option>
            <option value="PHP">PHP (菲律宾比索)</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">收款人/钱包标签</label>
        <input type="text" id="pmAccountName" class="form-input" placeholder="收款人姓名或钱包标签">
      </div>
      
      <div class="form-group">
        <label class="form-label">账号/钱包地址 *</label>
        <input type="text" id="pmAccountNumber" class="form-input" required placeholder="银行卡号或钱包地址">
      </div>
      
      <div id="bankFields" class="hidden">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">银行名称</label>
            <input type="text" id="pmBankName" class="form-input" placeholder="如: 中国工商银行">
          </div>
          <div class="form-group">
            <label class="form-label">开户支行</label>
            <input type="text" id="pmBankBranch" class="form-input" placeholder="如: 北京朝阳支行">
          </div>
        </div>
      </div>
      
      <div id="cryptoFields" class="hidden">
        <div class="form-group">
          <label class="form-label">汇率 (1单位 = ?CNY)</label>
          <input type="number" id="pmExchangeRate" class="form-input" step="0.01" placeholder="如: 7.25">
        </div>
      </div>
      
      <!-- 二维码上传 -->
      <div class="form-group">
        <label class="form-label">收款二维码</label>
        <div class="qr-upload-area" id="qrUploadArea" onclick="document.getElementById('qrFileInput').click()">
          <input type="file" id="qrFileInput" class="hidden" accept="image/*" onchange="handleQRCodeUpload(event)">
          <div id="qrPreviewContainer" class="hidden">
            <img id="qrPreview" class="qr-preview-img" alt="二维码预览">
            <button type="button" class="qr-remove-btn" onclick="removeQRCode(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="qrUploadPlaceholder" class="qr-upload-placeholder">
            <i class="fas fa-qrcode text-3xl text-gray-400 mb-2"></i>
            <p class="text-sm text-gray-500">点击上传收款二维码</p>
            <p class="text-xs text-gray-400 mt-1">支持 JPG/PNG 格式</p>
          </div>
        </div>
        <input type="hidden" id="pmQrCodeUrl">
      </div>
      
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="form-label">最低限额</label>
          <input type="number" id="pmMinAmount" class="form-input" value="100" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">最高限额</label>
          <input type="number" id="pmMaxAmount" class="form-input" value="1000000" min="0">
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">使用说明</label>
        <textarea id="pmDescription" class="form-input" rows="2" placeholder="给用户的使用说明"></textarea>
      </div>
      
      <div class="grid grid-2 gap-md">
        <div class="form-group">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="pmIsDefault">
            <span>设为默认收款方式</span>
          </label>
        </div>
        <div class="form-group">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="pmStatus" checked>
            <span>立即启用</span>
          </label>
        </div>
      </div>
      
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-success flex-1">创建收款方式</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增收款方式', content, { width: '600px' })
}

// 根据类型显示/隐藏字段
function updatePaymentMethodForm() {
  const type = document.getElementById('pmType')?.value
  const bankFields = document.getElementById('bankFields')
  const cryptoFields = document.getElementById('cryptoFields')
  const currencySelect = document.getElementById('pmCurrency')
  
  if (bankFields) bankFields.classList.toggle('hidden', type !== 'bank')
  if (cryptoFields) cryptoFields.classList.toggle('hidden', type !== 'crypto')
  
  // 根据类型设置默认货币
  if (currencySelect) {
    if (type === 'crypto') currencySelect.value = 'USDT'
    else if (type === 'bank') currencySelect.value = 'CNY'
  }
}

// 二维码上传处理
function handleQRCodeUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    showNotification('请选择图片文件', 'warning')
    return
  }
  
  // 验证文件大小 (最大 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showNotification('图片大小不能超过 2MB', 'warning')
    return
  }
  
  // 读取文件并转为 base64
  const reader = new FileReader()
  reader.onload = function(e) {
    const base64Data = e.target.result
    
    // 显示预览
    document.getElementById('qrPreview').src = base64Data
    document.getElementById('qrPreviewContainer').classList.remove('hidden')
    document.getElementById('qrUploadPlaceholder').classList.add('hidden')
    document.getElementById('pmQrCodeUrl').value = base64Data
  }
  reader.readAsDataURL(file)
}

// 移除二维码
function removeQRCode(event) {
  event.stopPropagation()
  document.getElementById('qrPreview').src = ''
  document.getElementById('qrPreviewContainer').classList.add('hidden')
  document.getElementById('qrUploadPlaceholder').classList.remove('hidden')
  document.getElementById('pmQrCodeUrl').value = ''
  document.getElementById('qrFileInput').value = ''
}

// 提交新增收款方式
async function submitAddPaymentMethod(e) {
  e.preventDefault()
  
  try {
    await API.post('/payment-methods', {
      method_code: document.getElementById('pmCode').value,
      method_name: document.getElementById('pmName').value,
      method_type: document.getElementById('pmType').value,
      currency: document.getElementById('pmCurrency').value,
      account_name: document.getElementById('pmAccountName').value,
      account_number: document.getElementById('pmAccountNumber').value,
      bank_name: document.getElementById('pmBankName')?.value || '',
      bank_branch: document.getElementById('pmBankBranch')?.value || '',
      qr_code_url: document.getElementById('pmQrCodeUrl')?.value || '',
      exchange_rate: parseFloat(document.getElementById('pmExchangeRate')?.value) || null,
      min_amount: parseFloat(document.getElementById('pmMinAmount').value) || 100,
      max_amount: parseFloat(document.getElementById('pmMaxAmount').value) || 1000000,
      description: document.getElementById('pmDescription').value,
      is_default: document.getElementById('pmIsDefault').checked ? 1 : 0,
      status: document.getElementById('pmStatus').checked ? 1 : 0
    })
    
    showNotification('收款方式创建成功', 'success')
    closeAllModals()
    switchFinanceTab('payment-methods')
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

// 编辑收款方式
async function editPaymentMethod(id) {
  try {
    const data = await API.get(`/payment-methods/${id}`)
    const pm = data.data
    
    const content = `
      <form onsubmit="submitEditPaymentMethod(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">方式代码</label>
            <input type="text" id="editPmCode" class="form-input" value="${escapeHtml(pm.method_code)}" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">显示名称 *</label>
            <input type="text" id="editPmName" class="form-input" value="${escapeHtml(pm.method_name)}" required>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">收款人/钱包标签</label>
          <input type="text" id="editPmAccountName" class="form-input" value="${escapeHtml(pm.account_name || '')}">
        </div>
        
        <div class="form-group">
          <label class="form-label">账号/钱包地址 *</label>
          <input type="text" id="editPmAccountNumber" class="form-input" value="${escapeHtml(pm.account_number || '')}" required>
        </div>
        
        ${pm.method_type === 'bank' ? `
          <div class="grid grid-2 gap-md">
            <div class="form-group">
              <label class="form-label">银行名称</label>
              <input type="text" id="editPmBankName" class="form-input" value="${escapeHtml(pm.bank_name || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">开户支行</label>
              <input type="text" id="editPmBankBranch" class="form-input" value="${escapeHtml(pm.bank_branch || '')}">
            </div>
          </div>
        ` : ''}
        
        ${pm.method_type === 'crypto' ? `
          <div class="form-group">
            <label class="form-label">汇率 (1 ${pm.currency} = ?CNY)</label>
            <input type="number" id="editPmExchangeRate" class="form-input" step="0.01" value="${pm.exchange_rate || ''}">
          </div>
        ` : ''}
        
        <!-- 二维码编辑 -->
        <div class="form-group">
          <label class="form-label">收款二维码</label>
          <div class="qr-upload-area" id="editQrUploadArea" onclick="document.getElementById('editQrFileInput').click()">
            <input type="file" id="editQrFileInput" class="hidden" accept="image/*" onchange="handleEditQRCodeUpload(event)">
            <div id="editQrPreviewContainer" class="${pm.qr_code_url ? '' : 'hidden'}">
              <img id="editQrPreview" class="qr-preview-img" src="${pm.qr_code_url || ''}" alt="二维码预览">
              <button type="button" class="qr-remove-btn" onclick="removeEditQRCode(event)">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div id="editQrUploadPlaceholder" class="qr-upload-placeholder ${pm.qr_code_url ? 'hidden' : ''}">
              <i class="fas fa-qrcode text-3xl text-gray-400 mb-2"></i>
              <p class="text-sm text-gray-500">点击上传收款二维码</p>
              <p class="text-xs text-gray-400 mt-1">支持 JPG/PNG 格式</p>
            </div>
          </div>
          <input type="hidden" id="editPmQrCodeUrl" value="${pm.qr_code_url || ''}">
        </div>
        
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">最低限额</label>
            <input type="number" id="editPmMinAmount" class="form-input" value="${pm.min_amount}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">最高限额</label>
            <input type="number" id="editPmMaxAmount" class="form-input" value="${pm.max_amount}" min="0">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">使用说明</label>
          <textarea id="editPmDescription" class="form-input" rows="2">${escapeHtml(pm.description || '')}</textarea>
        </div>
        
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑收款方式', content, { width: '600px' })
  } catch (error) {
    showNotification('获取信息失败', 'danger')
  }
}

// 编辑表单二维码上传处理
function handleEditQRCodeUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    showNotification('请选择图片文件', 'warning')
    return
  }
  
  if (file.size > 2 * 1024 * 1024) {
    showNotification('图片大小不能超过 2MB', 'warning')
    return
  }
  
  const reader = new FileReader()
  reader.onload = function(e) {
    const base64Data = e.target.result
    document.getElementById('editQrPreview').src = base64Data
    document.getElementById('editQrPreviewContainer').classList.remove('hidden')
    document.getElementById('editQrUploadPlaceholder').classList.add('hidden')
    document.getElementById('editPmQrCodeUrl').value = base64Data
  }
  reader.readAsDataURL(file)
}

// 移除编辑表单的二维码
function removeEditQRCode(event) {
  event.stopPropagation()
  document.getElementById('editQrPreview').src = ''
  document.getElementById('editQrPreviewContainer').classList.add('hidden')
  document.getElementById('editQrUploadPlaceholder').classList.remove('hidden')
  document.getElementById('editPmQrCodeUrl').value = ''
  document.getElementById('editQrFileInput').value = ''
}

// 提交编辑收款方式
async function submitEditPaymentMethod(e, id) {
  e.preventDefault()
  
  try {
    const data = {
      method_name: document.getElementById('editPmName').value,
      account_name: document.getElementById('editPmAccountName').value,
      account_number: document.getElementById('editPmAccountNumber').value,
      qr_code_url: document.getElementById('editPmQrCodeUrl')?.value || '',
      min_amount: parseFloat(document.getElementById('editPmMinAmount').value),
      max_amount: parseFloat(document.getElementById('editPmMaxAmount').value),
      description: document.getElementById('editPmDescription').value
    }
    
    // 银行卡字段
    if (document.getElementById('editPmBankName')) {
      data.bank_name = document.getElementById('editPmBankName').value
      data.bank_branch = document.getElementById('editPmBankBranch').value
    }
    
    // 加密货币汇率
    if (document.getElementById('editPmExchangeRate')) {
      data.exchange_rate = parseFloat(document.getElementById('editPmExchangeRate').value) || null
    }
    
    await API.put(`/payment-methods/${id}`, data)
    showNotification('收款方式更新成功', 'success')
    closeAllModals()
    switchFinanceTab('payment-methods')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

// 切换收款方式状态
async function togglePaymentMethod(id) {
  try {
    const result = await API.post(`/payment-methods/${id}/toggle`)
    showNotification(result.message, 'success')
    switchFinanceTab('payment-methods')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// 设为默认收款方式
async function setDefaultPaymentMethod(id) {
  if (!confirm('确定要将此收款方式设为默认吗?')) return
  
  try {
    await API.post(`/payment-methods/${id}/set-default`)
    showNotification('已设为默认收款方式', 'success')
    switchFinanceTab('payment-methods')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// 删除收款方式
async function deletePaymentMethod(id) {
  if (!confirm('确定要删除此收款方式吗? 如有关联存款记录将改为禁用。')) return
  
  try {
    const result = await API.delete(`/payment-methods/${id}`)
    showNotification(result.message, 'success')
    switchFinanceTab('payment-methods')
  } catch (error) {
    showNotification('删除失败', 'danger')
  }
}

// 显示二维码大图弹窗
function showQRCodeModal(name, qrCodeUrl) {
  const content = `
    <div class="text-center">
      <div class="inline-block p-4 bg-white rounded-lg shadow-inner border">
        <img src="${qrCodeUrl}" alt="收款二维码" class="max-w-full" style="max-height: 300px; object-fit: contain;">
      </div>
      <p class="text-gray-500 mt-4 text-sm">
        <i class="fas fa-info-circle mr-1"></i>
        扫描二维码向 <strong>${escapeHtml(name)}</strong> 付款
      </p>
      <div class="mt-4">
        <button onclick="downloadQRCode('${qrCodeUrl}', '${escapeHtml(name)}')" class="btn btn-primary btn-sm">
          <i class="fas fa-download mr-1"></i>下载二维码
        </button>
      </div>
    </div>
  `
  showModal(`${escapeHtml(name)} - 收款二维码`, content, { width: '400px' })
}

// 下载二维码
function downloadQRCode(qrCodeUrl, name) {
  const link = document.createElement('a')
  link.href = qrCodeUrl
  link.download = `收款二维码_${name}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  showNotification('二维码下载中...', 'info')
}

async function editAnnouncement(id) {
  try {
    const data = await API.get('/announcements')
    const ann = data.data.find(a => a.id === id)
    if (!ann) throw new Error('公告不存在')
    
    const content = `
      <form onsubmit="submitEditAnnouncement(event, ${id})">
        <div class="form-group">
          <label class="form-label">标题 *</label>
          <input type="text" id="editAnnTitle" class="form-input" value="${escapeHtml(ann.title)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">内容 *</label>
          <textarea id="editAnnContent" class="form-input" rows="4" required>${escapeHtml(ann.content)}</textarea>
        </div>
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">类型</label>
            <select id="editAnnType" class="form-select">
              <option value="system" ${ann.announcement_type === 'system' ? 'selected' : ''}>系统公告</option>
              <option value="activity" ${ann.announcement_type === 'activity' ? 'selected' : ''}>活动公告</option>
              <option value="important" ${ann.announcement_type === 'important' ? 'selected' : ''}>重要通知</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <select id="editAnnStatus" class="form-select">
              <option value="0" ${ann.status === 0 ? 'selected' : ''}>草稿</option>
              <option value="1" ${ann.status === 1 ? 'selected' : ''}>已发布</option>
              <option value="2" ${ann.status === 2 ? 'selected' : ''}>已下架</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑公告', content, { width: '500px' })
  } catch (error) {
    showNotification('获取公告失败', 'danger')
  }
}

async function submitEditAnnouncement(e, id) {
  e.preventDefault()
  try {
    await API.put(`/announcements/${id}`, {
      title: document.getElementById('editAnnTitle').value,
      content: document.getElementById('editAnnContent').value,
      announcement_type: document.getElementById('editAnnType').value,
      status: parseInt(document.getElementById('editAnnStatus').value)
    })
    showNotification('公告更新成功', 'success')
    closeAllModals()
    loadModule('content')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

// ============================================
// 完整功能实现 - 系统设置
// ============================================

function showAddConfigModal() {
  const content = `
    <form onsubmit="submitAddConfig(event)">
      <div class="form-group">
        <label class="form-label">配置键名 *</label>
        <input type="text" id="newConfigKey" class="form-input" required placeholder="system.max_bet">
      </div>
      <div class="form-group">
        <label class="form-label">配置值 *</label>
        <input type="text" id="newConfigValue" class="form-input" required>
      </div>
      <div class="form-group">
        <label class="form-label">配置类型</label>
        <select id="newConfigType" class="form-select">
          <option value="string">字符串</option>
          <option value="number">数字</option>
          <option value="boolean">布尔</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <input type="text" id="newConfigDesc" class="form-input">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">保存配置</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增系统配置', content, { width: '450px' })
}

async function submitAddConfig(e) {
  e.preventDefault()
  try {
    await API.post('/settings/configs', {
      config_key: document.getElementById('newConfigKey').value,
      config_value: document.getElementById('newConfigValue').value,
      config_type: document.getElementById('newConfigType').value,
      description: document.getElementById('newConfigDesc').value
    })
    showNotification('配置保存成功', 'success')
    closeAllModals()
    loadModule('settings')
  } catch (error) {
    showNotification('保存失败', 'danger')
  }
}

async function editConfig(key) {
  try {
    const data = await API.get('/settings/configs')
    const config = data.data.find(c => c.config_key === key)
    if (!config) throw new Error('配置不存在')
    
    const content = `
      <form onsubmit="submitEditConfig(event)">
        <div class="form-group">
          <label class="form-label">配置键名</label>
          <input type="text" id="editConfigKey" class="form-input" value="${escapeHtml(config.config_key)}" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">配置值 *</label>
          <input type="text" id="editConfigValue" class="form-input" value="${escapeHtml(config.config_value)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">配置类型</label>
          <select id="editConfigType" class="form-select">
            <option value="string" ${config.config_type === 'string' ? 'selected' : ''}>字符串</option>
            <option value="number" ${config.config_type === 'number' ? 'selected' : ''}>数字</option>
            <option value="boolean" ${config.config_type === 'boolean' ? 'selected' : ''}>布尔</option>
            <option value="json" ${config.config_type === 'json' ? 'selected' : ''}>JSON</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <input type="text" id="editConfigDesc" class="form-input" value="${escapeHtml(config.description || '')}">
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存修改</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑系统配置', content, { width: '450px' })
  } catch (error) {
    showNotification('获取配置失败', 'danger')
  }
}

async function submitEditConfig(e) {
  e.preventDefault()
  try {
    await API.post('/settings/configs', {
      config_key: document.getElementById('editConfigKey').value,
      config_value: document.getElementById('editConfigValue').value,
      config_type: document.getElementById('editConfigType').value,
      description: document.getElementById('editConfigDesc').value
    })
    showNotification('配置更新成功', 'success')
    closeAllModals()
    loadModule('settings')
  } catch (error) {
    showNotification('更新失败', 'danger')
  }
}

// ============================================
// 系统设置 - 8个标签页功能
// ============================================

// 切换系统设置标签页
function switchSettingsTab(tab) {
  const tabs = document.querySelectorAll('.tabs .tab')
  tabs.forEach((t, i) => {
    t.classList.remove('active')
    const tabNames = ['profile', 'password', '2fa', 'ip-whitelist', 'admins', 'roles', 'operation-logs', 'login-logs']
    if (tabNames[i] === tab) t.classList.add('active')
  })
  
  switch(tab) {
    case 'profile': loadSettingsProfile(); break
    case 'password': loadSettingsPassword(); break
    case '2fa': loadSettings2FA(); break
    case 'ip-whitelist': loadSettingsIPWhitelist(); break
    case 'admins': loadSettingsAdmins(); break
    case 'roles': loadSettingsRoles(); break
    case 'operation-logs': loadSettingsOperationLogs(); break
    case 'login-logs': loadSettingsLoginLogs(); break
  }
}

// 1. 个人信息
async function loadSettingsProfile() {
  const container = document.getElementById('settingsContent')
  const user = AppState.currentUser
  
  if (!user) {
    container.innerHTML = showEmpty('user', '请先登录')
    return
  }
  
  container.innerHTML = `
    <div class="max-w-2xl">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
        <div class="flex items-center gap-6">
          <div class="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
            ${(user.realName || user.username || '').charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 class="text-xl font-bold text-gray-800">${escapeHtml(user.realName || user.username)}</h3>
            <p class="text-gray-500">${getRoleDisplay(user.role)}</p>
            <p class="text-sm text-gray-400 mt-1">上次登录: ${user.lastLoginAt || '首次登录'}</p>
          </div>
        </div>
      </div>
      
      <form onsubmit="submitProfileUpdate(event)">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" value="${escapeHtml(user.username)}" readonly disabled>
          </div>
          <div class="form-group">
            <label class="form-label">真实姓名</label>
            <input type="text" id="profileRealName" class="form-input" value="${escapeHtml(user.realName || '')}" placeholder="请输入真实姓名">
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" id="profileEmail" class="form-input" value="${escapeHtml(user.email || '')}" placeholder="请输入邮箱">
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input type="text" id="profilePhone" class="form-input" value="${escapeHtml(user.phone || '')}" placeholder="请输入手机号">
          </div>
        </div>
        <div class="mt-6">
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save mr-2"></i>保存修改
          </button>
        </div>
      </form>
    </div>
  `
}

async function submitProfileUpdate(e) {
  e.preventDefault()
  try {
    await API.put(`/admins/${AppState.currentUser.id}`, {
      real_name: document.getElementById('profileRealName').value,
      email: document.getElementById('profileEmail').value,
      phone: document.getElementById('profilePhone').value
    })
    
    // 更新本地存储
    AppState.currentUser.realName = document.getElementById('profileRealName').value
    AppState.currentUser.email = document.getElementById('profileEmail').value
    AppState.currentUser.phone = document.getElementById('profilePhone').value
    localStorage.setItem('adminUser', JSON.stringify(AppState.currentUser))
    updateUserDisplay()
    
    showNotification('个人信息更新成功', 'success')
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

// 2. 修改密码
function loadSettingsPassword() {
  const container = document.getElementById('settingsContent')
  
  container.innerHTML = `
    <div class="max-w-md">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div class="flex items-center gap-3">
          <i class="fas fa-exclamation-triangle text-yellow-600"></i>
          <div>
            <p class="font-semibold text-yellow-800">安全提示</p>
            <p class="text-sm text-yellow-700">修改密码后需要重新登录</p>
          </div>
        </div>
      </div>
      
      <form onsubmit="submitPasswordChange(event)">
        <div class="form-group">
          <label class="form-label">原密码 *</label>
          <input type="password" id="pwdOld" class="form-input" required placeholder="请输入原密码">
        </div>
        <div class="form-group">
          <label class="form-label">新密码 *</label>
          <input type="password" id="pwdNew" class="form-input" required placeholder="请输入新密码 (至少6位)">
        </div>
        <div class="form-group">
          <label class="form-label">确认新密码 *</label>
          <input type="password" id="pwdConfirm" class="form-input" required placeholder="请再次输入新密码">
        </div>
        <div class="mt-6">
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-key mr-2"></i>修改密码
          </button>
        </div>
      </form>
    </div>
  `
}

async function submitPasswordChange(e) {
  e.preventDefault()
  const oldPwd = document.getElementById('pwdOld').value
  const newPwd = document.getElementById('pwdNew').value
  const confirmPwd = document.getElementById('pwdConfirm').value
  
  if (newPwd.length < 6) {
    showNotification('新密码至少需要6位', 'warning')
    return
  }
  
  if (newPwd !== confirmPwd) {
    showNotification('两次输入的密码不一致', 'warning')
    return
  }
  
  try {
    await API.post('/auth/change-password', {
      adminId: AppState.currentUser.id,
      oldPassword: oldPwd,
      newPassword: newPwd
    })
    showNotification('密码修改成功，请重新登录', 'success')
    setTimeout(() => handleLogout(), 2000)
  } catch (error) {
    showNotification('修改失败: ' + error.message, 'danger')
  }
}

// 3. 2FA设置
async function loadSettings2FA() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get(`/2fa/status/${AppState.currentUser.id}`)
    const isEnabled = result.data?.is_enabled || false
    
    container.innerHTML = `
      <div class="max-w-lg">
        <div class="bg-indigo-50 rounded-lg p-6 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-gray-400'} flex items-center justify-center">
                <i class="fas fa-shield-alt text-white text-xl"></i>
              </div>
              <div>
                <h4 class="font-bold text-gray-800">双因素认证 (2FA)</h4>
                <p class="text-sm text-gray-500">使用Google Authenticator或类似应用</p>
              </div>
            </div>
            <span class="badge ${isEnabled ? 'badge-success' : 'badge-gray'} text-lg px-4 py-2">
              ${isEnabled ? '已启用' : '未启用'}
            </span>
          </div>
        </div>
        
        <div class="bg-white border rounded-lg p-6">
          <h5 class="font-semibold mb-4">${isEnabled ? '禁用2FA' : '启用2FA'}</h5>
          ${isEnabled ? `
            <p class="text-gray-600 mb-4">禁用双因素认证会降低账户安全性，请谨慎操作。</p>
            <button onclick="toggle2FA(false)" class="btn btn-danger">
              <i class="fas fa-times mr-2"></i>禁用2FA
            </button>
          ` : `
            <p class="text-gray-600 mb-4">启用双因素认证可以大幅提升账户安全性。启用后，每次登录都需要输入验证码。</p>
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <p class="text-sm text-gray-500 mb-2">1. 下载并安装 Google Authenticator 应用</p>
              <p class="text-sm text-gray-500 mb-2">2. 扫描二维码或手动输入密钥</p>
              <p class="text-sm text-gray-500">3. 输入验证码完成绑定</p>
            </div>
            <button onclick="toggle2FA(true)" class="btn btn-success">
              <i class="fas fa-check mr-2"></i>启用2FA
            </button>
          `}
        </div>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

async function toggle2FA(enable) {
  if (enable) {
    if (!confirm('确定要启用双因素认证吗？')) return
  } else {
    if (!confirm('确定要禁用双因素认证吗？这会降低账户安全性。')) return
  }
  
  try {
    await API.post('/2fa/toggle', {
      admin_id: AppState.currentUser.id,
      is_enabled: enable
    })
    showNotification(enable ? '2FA已启用' : '2FA已禁用', 'success')
    loadSettings2FA()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

// 4. IP白名单
async function loadSettingsIPWhitelist() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/ip-whitelist')
    const list = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm text-gray-500">共 ${list.length} 条IP记录</span>
        </div>
        <button onclick="showAddIPModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>添加IP
        </button>
      </div>
      
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>IP地址</th>
              <th>描述</th>
              <th>添加人</th>
              <th class="text-center">状态</th>
              <th>添加时间</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6">${showEmpty('network-wired', '暂无IP白名单')}</td></tr>` :
              list.map(ip => `
                <tr>
                  <td class="font-mono text-blue-600">${escapeHtml(ip.ip_address)}</td>
                  <td class="text-gray-500">${escapeHtml(ip.description || '-')}</td>
                  <td>${escapeHtml(ip.admin_username || '-')}</td>
                  <td class="text-center">
                    <span class="badge ${ip.status === 1 ? 'badge-success' : 'badge-gray'} cursor-pointer"
                          onclick="toggleIPStatus(${ip.id}, ${ip.status === 1 ? 0 : 1})">
                      ${ip.status === 1 ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td class="text-sm text-gray-500">${formatShortDate(ip.created_at)}</td>
                  <td class="text-center">
                    <button onclick="deleteIP(${ip.id})" class="btn btn-danger btn-xs">删除</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function showAddIPModal() {
  const content = `
    <form onsubmit="submitAddIP(event)">
      <div class="form-group">
        <label class="form-label">IP地址 *</label>
        <input type="text" id="newIPAddress" class="form-input" required placeholder="如: 192.168.1.100 或 192.168.1.0/24">
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <input type="text" id="newIPDesc" class="form-input" placeholder="如: 办公室IP">
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">添加</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('添加IP白名单', content, { width: '400px' })
}

async function submitAddIP(e) {
  e.preventDefault()
  try {
    await API.post('/ip-whitelist', {
      ip_address: document.getElementById('newIPAddress').value,
      description: document.getElementById('newIPDesc').value,
      admin_id: AppState.currentUser.id
    })
    showNotification('IP添加成功', 'success')
    closeAllModals()
    loadSettingsIPWhitelist()
  } catch (error) {
    showNotification('添加失败: ' + error.message, 'danger')
  }
}

async function toggleIPStatus(id, newStatus) {
  try {
    await API.put(`/ip-whitelist/${id}`, { status: newStatus })
    showNotification(newStatus ? 'IP已启用' : 'IP已禁用', 'success')
    loadSettingsIPWhitelist()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

async function deleteIP(id) {
  if (!confirm('确定要删除这条IP记录吗？')) return
  try {
    await API.delete(`/ip-whitelist/${id}`)
    showNotification('IP删除成功', 'success')
    loadSettingsIPWhitelist()
  } catch (error) {
    showNotification('删除失败: ' + error.message, 'danger')
  }
}

// 5. 管理员账号
async function loadSettingsAdmins() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/admins')
    const admins = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm text-gray-500">共 ${admins.length} 个管理员账号</span>
        </div>
        <button onclick="showAddAdminModal()" class="btn btn-success btn-sm">
          <i class="fas fa-user-plus mr-1"></i>新增管理员
        </button>
      </div>
      
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>姓名</th>
              <th>角色</th>
              <th>2FA</th>
              <th class="text-center">状态</th>
              <th>最后登录</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            ${admins.map(admin => `
              <tr>
                <td class="font-semibold text-blue-600">${escapeHtml(admin.username)}</td>
                <td>${escapeHtml(admin.nickname || '-')}</td>
                <td><span class="badge badge-purple">${escapeHtml(admin.roles || 'admin')}</span></td>
                <td>
                  <span class="badge ${admin.two_fa_enabled ? 'badge-success' : 'badge-gray'}">
                    ${admin.two_fa_enabled ? '已启用' : '未启用'}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge ${admin.status === 1 ? 'badge-success' : 'badge-danger'}">
                    ${admin.status === 1 ? '正常' : '禁用'}
                  </span>
                </td>
                <td class="text-sm text-gray-500">${admin.last_login_at ? formatShortDate(admin.last_login_at) : '从未登录'}</td>
                <td class="text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button onclick="editAdmin(${admin.id})" class="btn btn-primary btn-xs">编辑</button>
                    <button onclick="manageAdminIpBindings(${admin.id}, '${escapeHtml(admin.username)}')" class="btn btn-info btn-xs" title="IP白名单">
                      <i class="fas fa-shield-alt"></i>
                    </button>
                    ${admin.id !== AppState.currentUser.id ? `
                      <button onclick="toggleAdminStatus(${admin.id}, ${admin.status === 1 ? 0 : 1})" 
                              class="btn ${admin.status === 1 ? 'btn-warning' : 'btn-success'} btn-xs">
                        ${admin.status === 1 ? '禁用' : '启用'}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

function showAddAdminModal() {
  const content = `
    <form onsubmit="submitAddAdmin(event)">
      <div class="grid grid-cols-2 gap-4">
        <div class="form-group">
          <label class="form-label">用户名 *</label>
          <input type="text" id="newAdminUsername" class="form-input" required placeholder="登录用户名">
        </div>
        <div class="form-group">
          <label class="form-label">密码 *</label>
          <input type="password" id="newAdminPassword" class="form-input" required placeholder="登录密码">
        </div>
        <div class="form-group">
          <label class="form-label">姓名</label>
          <input type="text" id="newAdminNickname" class="form-input" placeholder="真实姓名">
        </div>
        <div class="form-group">
          <label class="form-label">邮箱</label>
          <input type="email" id="newAdminEmail" class="form-input" placeholder="电子邮箱">
        </div>
        <div class="form-group col-span-2">
          <label class="form-label">手机号</label>
          <input type="text" id="newAdminPhone" class="form-input" placeholder="手机号码">
        </div>
      </div>
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">创建</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('新增管理员', content, { width: '500px' })
}

async function submitAddAdmin(e) {
  e.preventDefault()
  try {
    await API.post('/admins', {
      username: document.getElementById('newAdminUsername').value,
      password: document.getElementById('newAdminPassword').value,
      nickname: document.getElementById('newAdminNickname').value,
      email: document.getElementById('newAdminEmail').value,
      phone: document.getElementById('newAdminPhone').value
    })
    showNotification('管理员创建成功', 'success')
    closeAllModals()
    loadSettingsAdmins()
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

async function editAdmin(id) {
  try {
    const result = await API.get('/admins')
    const admin = result.data.find(a => a.id === id)
    if (!admin) throw new Error('管理员不存在')
    
    const content = `
      <form onsubmit="submitEditAdmin(event, ${id})">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input type="text" class="form-input" value="${escapeHtml(admin.username)}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input type="text" id="editAdminNickname" class="form-input" value="${escapeHtml(admin.nickname || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" id="editAdminEmail" class="form-input" value="${escapeHtml(admin.email || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input type="text" id="editAdminPhone" class="form-input" value="${escapeHtml(admin.phone || '')}">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑管理员', content, { width: '500px' })
  } catch (error) {
    showNotification('获取信息失败: ' + error.message, 'danger')
  }
}

async function submitEditAdmin(e, id) {
  e.preventDefault()
  try {
    await API.put(`/admins/${id}`, {
      nickname: document.getElementById('editAdminNickname').value,
      email: document.getElementById('editAdminEmail').value,
      phone: document.getElementById('editAdminPhone').value
    })
    showNotification('管理员更新成功', 'success')
    closeAllModals()
    loadSettingsAdmins()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

async function toggleAdminStatus(id, newStatus) {
  if (!confirm(newStatus ? '确定启用该管理员吗？' : '确定禁用该管理员吗？')) return
  try {
    await API.put(`/admins/${id}`, { status: newStatus })
    showNotification(newStatus ? '管理员已启用' : '管理员已禁用', 'success')
    loadSettingsAdmins()
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

// 管理员IP白名单绑定
async function manageAdminIpBindings(adminId, username) {
  try {
    const result = await API.get(`/admins/${adminId}/ip-bindings`)
    const bindings = result.data || []
    
    const content = `
      <div class="mb-4">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-500">管理员: <strong>${escapeHtml(username)}</strong> 的IP白名单</span>
          <button onclick="showAddAdminIpModal(${adminId})" class="btn btn-success btn-sm">
            <i class="fas fa-plus mr-1"></i>添加IP
          </button>
        </div>
      </div>
      
      ${bindings.length === 0 ? `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-shield-alt text-4xl mb-3 text-gray-300"></i>
          <p>暂无IP白名单，该管理员可从任意IP登录</p>
          <p class="text-xs mt-1">添加IP后，该管理员只能从白名单IP登录</p>
        </div>
      ` : `
        <div class="data-table-wrapper" style="max-height: 300px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>IP地址</th>
                <th>描述</th>
                <th class="text-center">状态</th>
                <th>添加时间</th>
                <th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              ${bindings.map(b => `
                <tr>
                  <td class="font-mono">${escapeHtml(b.ip_address)}</td>
                  <td class="text-sm text-gray-500">${escapeHtml(b.description || '-')}</td>
                  <td class="text-center">
                    <span class="badge ${b.is_active ? 'badge-success' : 'badge-gray'}">
                      ${b.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td class="text-sm text-gray-500">${formatShortDate(b.created_at)}</td>
                  <td class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <button onclick="toggleAdminIpBinding(${adminId}, ${b.id}, ${b.is_active ? 0 : 1})" 
                              class="btn ${b.is_active ? 'btn-warning' : 'btn-success'} btn-xs">
                        ${b.is_active ? '禁用' : '启用'}
                      </button>
                      <button onclick="deleteAdminIpBinding(${adminId}, ${b.id})" class="btn btn-danger btn-xs">删除</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
      
      <div class="flex justify-end mt-6">
        <button onclick="closeAllModals()" class="btn btn-secondary">关闭</button>
      </div>
    `
    showModal('IP白名单管理', content, { width: '650px' })
  } catch (error) {
    showNotification('加载失败: ' + error.message, 'danger')
  }
}

function showAddAdminIpModal(adminId) {
  const content = `
    <form onsubmit="submitAddAdminIp(event, ${adminId})">
      <div class="form-group">
        <label class="form-label">IP地址 *</label>
        <input type="text" id="adminIpAddress" class="form-input" required 
               placeholder="支持单IP或CIDR格式，如: 192.168.1.100 或 192.168.1.0/24">
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <input type="text" id="adminIpDesc" class="form-input" placeholder="如: 办公室IP">
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700 mb-4">
        <i class="fas fa-info-circle mr-1"></i>
        添加IP后，该管理员只能从白名单IP登录。如设置 0.0.0.0/0 则允许所有IP。
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn btn-primary flex-1">添加</button>
        <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
      </div>
    </form>
  `
  showModal('添加IP白名单', content, { width: '450px' })
}

async function submitAddAdminIp(e, adminId) {
  e.preventDefault()
  try {
    await API.post(`/admins/${adminId}/ip-bindings`, {
      ip_address: document.getElementById('adminIpAddress').value,
      description: document.getElementById('adminIpDesc').value,
      created_by: AppState.currentUser.id
    })
    showNotification('IP添加成功', 'success')
    closeAllModals()
    manageAdminIpBindings(adminId, '')  // 重新打开管理窗口
  } catch (error) {
    showNotification('添加失败: ' + error.message, 'danger')
  }
}

async function toggleAdminIpBinding(adminId, bindingId, newStatus) {
  try {
    await API.post(`/admins/${adminId}/ip-bindings/${bindingId}/toggle`, { is_active: newStatus })
    showNotification(newStatus ? 'IP已启用' : 'IP已禁用', 'success')
    manageAdminIpBindings(adminId, '')
  } catch (error) {
    showNotification('操作失败: ' + error.message, 'danger')
  }
}

async function deleteAdminIpBinding(adminId, bindingId) {
  if (!confirm('确定删除该IP绑定吗？')) return
  try {
    await API.delete(`/admins/${adminId}/ip-bindings/${bindingId}`)
    showNotification('IP删除成功', 'success')
    manageAdminIpBindings(adminId, '')
  } catch (error) {
    showNotification('删除失败: ' + error.message, 'danger')
  }
}

// 6. 角色权限
async function loadSettingsRoles() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/roles')
    const roles = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm text-gray-500">共 ${roles.length} 个角色</span>
        </div>
        <button onclick="showAddRoleModal()" class="btn btn-success btn-sm">
          <i class="fas fa-plus mr-1"></i>新增角色
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        ${roles.map(role => `
          <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-3">
              <div>
                <h4 class="font-bold text-gray-800">${escapeHtml(role.role_display_name)}</h4>
                <p class="text-sm text-gray-500 font-mono">${escapeHtml(role.role_name)}</p>
              </div>
              <span class="badge badge-info">${role.admin_count || 0} 人</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">${escapeHtml(role.description || '无描述')}</p>
            <div class="flex items-center justify-between">
              <span class="badge ${role.status === 1 ? 'badge-success' : 'badge-gray'}">
                ${role.status === 1 ? '启用' : '禁用'}
              </span>
              <div class="flex gap-1">
                <button onclick="editRole(${role.id})" class="btn btn-primary btn-xs">编辑</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 权限树HTML生成
function renderPermissionTree(categories, selectedPermissions = []) {
  const isAll = selectedPermissions.includes('*')
  
  return categories.map(cat => {
    const catPermissions = cat.permissions || []
    const parentPerm = catPermissions.find(p => !p.parent_key)
    const childPerms = catPermissions.filter(p => p.parent_key)
    
    // 检查分类是否全选
    const childKeys = childPerms.map(p => p.permission_key)
    const selectedChildCount = childKeys.filter(k => isAll || selectedPermissions.includes(k)).length
    const isAllSelected = selectedChildCount === childKeys.length
    const isPartialSelected = selectedChildCount > 0 && selectedChildCount < childKeys.length
    
    return `
      <div class="permission-category mb-3 border rounded-lg overflow-hidden">
        <div class="permission-category-header bg-gray-50 px-3 py-2 flex items-center justify-between cursor-pointer" onclick="togglePermissionCategory('${cat.category}')">
          <div class="flex items-center gap-2">
            <input type="checkbox" 
                   id="cat_${cat.category}" 
                   class="permission-category-checkbox"
                   ${isAll || isAllSelected ? 'checked' : ''} 
                   ${isPartialSelected ? 'data-indeterminate="true"' : ''}
                   onchange="toggleCategoryPermissions('${cat.category}', this.checked)"
                   onclick="event.stopPropagation()">
            <label class="font-semibold text-gray-700 cursor-pointer" onclick="event.stopPropagation(); document.getElementById('cat_${cat.category}').click()">
              ${cat.category_name}
            </label>
            <span class="text-xs text-gray-400">(${selectedChildCount}/${childKeys.length})</span>
          </div>
          <i class="fas fa-chevron-down text-gray-400 transition-transform permission-toggle-icon" id="icon_${cat.category}"></i>
        </div>
        <div class="permission-category-body p-3 hidden" id="body_${cat.category}">
          <div class="grid grid-cols-2 gap-2">
            ${childPerms.map(perm => `
              <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" 
                       class="permission-checkbox" 
                       data-category="${cat.category}"
                       value="${perm.permission_key}"
                       ${isAll || selectedPermissions.includes(perm.permission_key) ? 'checked' : ''}
                       onchange="updateCategoryCheckbox('${cat.category}')">
                <div>
                  <div class="text-sm text-gray-700">${perm.permission_name}</div>
                  <div class="text-xs text-gray-400">${perm.description || ''}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `
  }).join('')
}

// 展开/收起分类
function togglePermissionCategory(category) {
  const body = document.getElementById(`body_${category}`)
  const icon = document.getElementById(`icon_${category}`)
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden')
    icon.style.transform = 'rotate(180deg)'
  } else {
    body.classList.add('hidden')
    icon.style.transform = 'rotate(0deg)'
  }
}

// 切换分类所有权限
function toggleCategoryPermissions(category, checked) {
  const checkboxes = document.querySelectorAll(`.permission-checkbox[data-category="${category}"]`)
  checkboxes.forEach(cb => cb.checked = checked)
}

// 更新分类复选框状态
function updateCategoryCheckbox(category) {
  const checkboxes = document.querySelectorAll(`.permission-checkbox[data-category="${category}"]`)
  const categoryCheckbox = document.getElementById(`cat_${category}`)
  const total = checkboxes.length
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length
  
  categoryCheckbox.checked = checked === total
  categoryCheckbox.indeterminate = checked > 0 && checked < total
  
  // 更新计数显示
  const header = categoryCheckbox.closest('.permission-category-header')
  const countSpan = header.querySelector('.text-xs.text-gray-400')
  if (countSpan) countSpan.textContent = `(${checked}/${total})`
}

// 获取选中的权限
function getSelectedPermissions() {
  const checkboxes = document.querySelectorAll('.permission-checkbox:checked')
  return Array.from(checkboxes).map(cb => cb.value)
}

// 全选/取消全选
function toggleAllPermissions(checked) {
  document.querySelectorAll('.permission-checkbox').forEach(cb => cb.checked = checked)
  document.querySelectorAll('.permission-category-checkbox').forEach(cb => {
    cb.checked = checked
    cb.indeterminate = false
  })
  // 更新所有计数
  document.querySelectorAll('.permission-category').forEach(cat => {
    const category = cat.querySelector('.permission-category-checkbox').id.replace('cat_', '')
    const checkboxes = cat.querySelectorAll('.permission-checkbox')
    const total = checkboxes.length
    const checkedCount = checked ? total : 0
    const countSpan = cat.querySelector('.text-xs.text-gray-400')
    if (countSpan) countSpan.textContent = `(${checkedCount}/${total})`
  })
}

async function showAddRoleModal() {
  try {
    const permResult = await API.get('/permissions')
    const categories = permResult.data || []
    
    const content = `
      <form onsubmit="submitAddRole(event)">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">角色标识 *</label>
            <input type="text" id="newRoleName" class="form-input" required placeholder="如: finance_manager">
          </div>
          <div class="form-group">
            <label class="form-label">角色名称 *</label>
            <input type="text" id="newRoleDisplayName" class="form-input" required placeholder="如: 财务主管">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea id="newRoleDesc" class="form-input" rows="2" placeholder="角色描述"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label flex items-center justify-between">
            <span>权限分配</span>
            <div class="flex gap-2">
              <button type="button" onclick="toggleAllPermissions(true)" class="btn btn-xs btn-secondary">全选</button>
              <button type="button" onclick="toggleAllPermissions(false)" class="btn btn-xs btn-secondary">清空</button>
            </div>
          </label>
          <div class="permission-tree mt-2 max-h-96 overflow-y-auto border rounded-lg p-2 bg-white">
            ${renderPermissionTree(categories, [])}
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">创建</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('新增角色', content, { width: '650px' })
  } catch (error) {
    showNotification('加载权限列表失败: ' + error.message, 'danger')
  }
}

async function submitAddRole(e) {
  e.preventDefault()
  try {
    const permissions = getSelectedPermissions()
    await API.post('/roles', {
      role_name: document.getElementById('newRoleName').value,
      role_display_name: document.getElementById('newRoleDisplayName').value,
      description: document.getElementById('newRoleDesc').value,
      permissions
    })
    showNotification('角色创建成功', 'success')
    closeAllModals()
    loadSettingsRoles()
  } catch (error) {
    showNotification('创建失败: ' + error.message, 'danger')
  }
}

async function editRole(id) {
  try {
    const [roleResult, permResult] = await Promise.all([
      API.get(`/roles/${id}`),
      API.get('/permissions')
    ])
    
    const role = roleResult.data
    if (!role) throw new Error('角色不存在')
    
    const categories = permResult.data || []
    const selectedPermissions = role.permissions || []
    const isAll = selectedPermissions.includes('*')
    
    const content = `
      <form onsubmit="submitEditRole(event, ${id})">
        <div class="grid grid-2 gap-md">
          <div class="form-group">
            <label class="form-label">角色标识</label>
            <input type="text" class="form-input bg-gray-100" value="${escapeHtml(role.role_name)}" disabled>
          </div>
          <div class="form-group">
            <label class="form-label">角色名称 *</label>
            <input type="text" id="editRoleDisplayName" class="form-input" value="${escapeHtml(role.role_display_name)}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea id="editRoleDesc" class="form-input" rows="2">${escapeHtml(role.description || '')}</textarea>
        </div>
        ${role.role_name === 'super_admin' ? `
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div class="flex items-center gap-2 text-amber-700">
              <i class="fas fa-crown"></i>
              <span class="font-semibold">超级管理员拥有所有权限，无需分配</span>
            </div>
          </div>
        ` : `
          <div class="form-group">
            <label class="form-label flex items-center justify-between">
              <span>权限分配</span>
              <div class="flex gap-2">
                <button type="button" onclick="toggleAllPermissions(true)" class="btn btn-xs btn-secondary">全选</button>
                <button type="button" onclick="toggleAllPermissions(false)" class="btn btn-xs btn-secondary">清空</button>
              </div>
            </label>
            <div class="permission-tree mt-2 max-h-96 overflow-y-auto border rounded-lg p-2 bg-white">
              ${renderPermissionTree(categories, selectedPermissions)}
            </div>
          </div>
        `}
        <div class="flex gap-2 mt-6">
          <button type="submit" class="btn btn-primary flex-1">保存</button>
          <button type="button" onclick="closeAllModals()" class="btn btn-secondary flex-1">取消</button>
        </div>
      </form>
    `
    showModal('编辑角色权限', content, { width: '650px' })
    
    // 初始化indeterminate状态
    setTimeout(() => {
      document.querySelectorAll('[data-indeterminate="true"]').forEach(cb => {
        cb.indeterminate = true
      })
    }, 100)
  } catch (error) {
    showNotification('获取角色失败: ' + error.message, 'danger')
  }
}

async function submitEditRole(e, id) {
  e.preventDefault()
  try {
    const permissions = getSelectedPermissions()
    // 如果是超级管理员，保持 ["*"]
    const roleNameInput = e.target.querySelector('input[disabled]')
    const isSuperAdmin = roleNameInput && roleNameInput.value === 'super_admin'
    
    await API.put(`/roles/${id}`, {
      role_display_name: document.getElementById('editRoleDisplayName').value,
      description: document.getElementById('editRoleDesc').value,
      permissions: isSuperAdmin ? ['*'] : permissions
    })
    showNotification('角色更新成功', 'success')
    closeAllModals()
    loadSettingsRoles()
  } catch (error) {
    showNotification('更新失败: ' + error.message, 'danger')
  }
}

// 7. 操作日志
async function loadSettingsOperationLogs() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/logs/operations', { limit: 50 })
    const logs = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm text-gray-500">显示最近 50 条操作日志</span>
        </div>
      </div>
      
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作员</th>
              <th>模块</th>
              <th>操作</th>
              <th>目标</th>
              <th>详情</th>
              <th>IP地址</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `<tr><td colspan="7">${showEmpty('history', '暂无操作日志')}</td></tr>` :
              logs.map(log => `
                <tr>
                  <td class="text-sm text-gray-500 whitespace-nowrap">${formatDateTime(log.created_at)}</td>
                  <td class="font-semibold">${escapeHtml(log.admin_username || '-')}</td>
                  <td><span class="badge badge-info">${escapeHtml(log.module || '-')}</span></td>
                  <td>${escapeHtml(log.action || '-')}</td>
                  <td class="text-sm">${escapeHtml(log.target_type || '')} ${log.target_id || ''}</td>
                  <td class="text-sm text-gray-500 truncate max-w-xs" title="${escapeHtml(log.details || '')}">${escapeHtml(log.details || '-')}</td>
                  <td class="font-mono text-xs">${escapeHtml(log.ip_address || '-')}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// 8. 登录日志
async function loadSettingsLoginLogs() {
  const container = document.getElementById('settingsContent')
  container.innerHTML = showLoading()
  
  try {
    const result = await API.get('/login-logs', { limit: 50 })
    const logs = result.data || []
    
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <span class="text-sm text-gray-500">显示最近 50 条登录日志</span>
        </div>
      </div>
      
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户名</th>
              <th>类型</th>
              <th>IP地址</th>
              <th>位置</th>
              <th>设备</th>
              <th class="text-center">状态</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `<tr><td colspan="7">${showEmpty('sign-in-alt', '暂无登录日志')}</td></tr>` :
              logs.map(log => `
                <tr>
                  <td class="text-sm text-gray-500 whitespace-nowrap">${formatDateTime(log.created_at)}</td>
                  <td class="font-semibold">${escapeHtml(log.admin_username || '-')}</td>
                  <td>
                    <span class="badge ${log.login_type === 'login' ? 'badge-success' : 'badge-gray'}">
                      ${log.login_type === 'login' ? '登录' : '登出'}
                    </span>
                  </td>
                  <td class="font-mono text-xs">${escapeHtml(log.ip_address || '-')}</td>
                  <td class="text-sm">${escapeHtml(log.location || '-')}</td>
                  <td class="text-sm text-gray-500 truncate max-w-xs" title="${escapeHtml(log.user_agent || '')}">${escapeHtml(log.user_agent || '-')}</td>
                  <td class="text-center">
                    <span class="badge ${log.status === 1 ? 'badge-success' : 'badge-danger'}">
                      ${log.status === 1 ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `
  } catch (error) {
    container.innerHTML = showEmpty('exclamation-circle', '加载失败: ' + error.message)
  }
}

// ============================================
// 在线玩家功能
// ============================================

async function loadOnlinePlayerCount() {
  try {
    const data = await API.get('/players/online', { limit: 1 })
    const badge = document.getElementById('onlinePlayerBadge')
    if (badge) {
      badge.textContent = data.total || 0
    }
  } catch (error) {
    console.error('获取在线玩家数量失败:', error)
  }
}

async function switchPlayerTab(tab) {
  const listTab = document.getElementById('playerListTab')
  const onlineTab = document.getElementById('onlinePlayerTab')
  const tabs = document.querySelectorAll('.tabs-container .tab-btn')
  
  tabs.forEach((t, i) => {
    t.classList.toggle('active', i === (tab === 'list' ? 0 : 1))
  })
  
  if (tab === 'list') {
    listTab.classList.remove('hidden')
    onlineTab.classList.add('hidden')
  } else {
    listTab.classList.add('hidden')
    onlineTab.classList.remove('hidden')
    await loadOnlinePlayers()
  }
}

async function loadOnlinePlayers(gameType = '', search = '') {
  const container = document.getElementById('onlinePlayerTab')
  container.innerHTML = showLoading()
  
  try {
    const params = { limit: 100 }
    if (gameType) params.game_type = gameType
    if (search) params.search = search
    
    const data = await API.get('/players/online', params)
    
    // 生成桌台分布HTML
    const tableStatsHtml = (data.tableStats || []).length > 0 ? `
      <div class="mb-4 p-4 bg-gray-50 rounded-lg">
        <div class="text-sm font-semibold text-gray-600 mb-3"><i class="fas fa-chart-pie mr-2"></i>桌台实时分布</div>
        <div class="flex flex-wrap gap-2">
          ${data.tableStats.map(t => `
            <div class="bg-white px-3 py-2 rounded-lg border flex items-center gap-2">
              <span class="badge badge-purple">${getGameTypeName(t.current_game_type)}</span>
              <span class="text-sm font-semibold">${t.table_name || t.table_code}</span>
              <span class="badge badge-success">${t.player_count}人</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''
    
    container.innerHTML = `
      <div class="card">
        <!-- 统计卡片 -->
        <div class="grid grid-cols-6 gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <div class="text-center">
            <div class="text-3xl font-bold text-indigo-600">${data.stats?.totalOnline || 0}</div>
            <div class="text-sm text-gray-500">在线玩家</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-emerald-600">${formatCurrency(data.stats?.totalBalance || 0)}</div>
            <div class="text-sm text-gray-500">在线玩家总余额</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600">${data.stats?.activeTables || 0}</div>
            <div class="text-sm text-gray-500">活跃桌台</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-amber-600">${data.stats?.gameDistribution?.baccarat || 0}</div>
            <div class="text-sm text-gray-500">百家乐</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">${data.stats?.gameDistribution?.dragon_tiger || 0}</div>
            <div class="text-sm text-gray-500">龙虎</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-purple-600">${(data.stats?.gameDistribution?.roulette || 0) + (data.stats?.gameDistribution?.sicbo || 0) + (data.stats?.gameDistribution?.niuniu || 0)}</div>
            <div class="text-sm text-gray-500">其他游戏</div>
          </div>
        </div>
        
        ${tableStatsHtml}
        
        <!-- 筛选栏 -->
        <div class="filter-bar">
          <div class="filter-search">
            <i class="fas fa-search"></i>
            <input type="text" id="onlinePlayerSearch" class="form-input" placeholder="搜索用户名/昵称..." value="${search}">
          </div>
          <select id="onlineGameFilter" class="form-select filter-select">
            <option value="">全部游戏</option>
            <option value="baccarat" ${gameType === 'baccarat' ? 'selected' : ''}>百家乐</option>
            <option value="dragon_tiger" ${gameType === 'dragon_tiger' ? 'selected' : ''}>龙虎</option>
            <option value="roulette" ${gameType === 'roulette' ? 'selected' : ''}>轮盘</option>
            <option value="sicbo" ${gameType === 'sicbo' ? 'selected' : ''}>骰宝</option>
            <option value="niuniu" ${gameType === 'niuniu' ? 'selected' : ''}>牛牛</option>
          </select>
          <button onclick="searchOnlinePlayers()" class="btn btn-primary btn-sm">
            <i class="fas fa-filter"></i> 筛选
          </button>
          <button onclick="loadOnlinePlayers()" class="btn btn-secondary btn-sm">
            <i class="fas fa-sync-alt"></i> 刷新
          </button>
          <button onclick="exportOnlinePlayers()" class="btn btn-success btn-sm">
            <i class="fas fa-download"></i> 导出
          </button>
        </div>
        
        <!-- 表格 -->
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户ID</th>
                <th>账号</th>
                <th>昵称</th>
                <th class="text-center">VIP等级</th>
                <th class="text-right">余额</th>
                <th>当前游戏</th>
                <th>桌台</th>
                <th>荷官</th>
                <th>登录IP</th>
                <th>登录时间</th>
                <th>最后活动</th>
                <th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              ${data.data.length === 0 ? `<tr><td colspan="12">${showEmpty('signal', '暂无在线玩家')}</td></tr>` :
                data.data.map(player => `
                <tr class="${player.vip_level >= 5 ? 'row-highlight' : ''}">
                  <td class="font-mono text-gray-500">${player.id}</td>
                  <td class="font-semibold">${escapeHtml(player.username)}</td>
                  <td class="text-gray-600">${escapeHtml(player.nickname || '-')}</td>
                  <td class="text-center">
                    <span class="badge ${player.vip_level >= 5 ? 'badge-warning' : player.vip_level >= 3 ? 'badge-info' : 'badge-secondary'}">
                      <i class="fas fa-crown mr-1"></i>VIP ${player.vip_level}
                    </span>
                  </td>
                  <td class="text-right font-mono font-semibold text-emerald-600">${formatCurrency(player.balance)}</td>
                  <td>
                    ${player.current_game_type ? `
                      <span class="badge badge-purple">
                        <i class="fas fa-gamepad mr-1"></i>${getGameTypeName(player.current_game_type)}
                      </span>
                    ` : '<span class="text-gray-400">未入座</span>'}
                  </td>
                  <td>
                    ${player.table_name ? `
                      <span class="text-blue-600 font-medium">${escapeHtml(player.table_name)}</span>
                      <div class="text-xs text-gray-400">${escapeHtml(player.table_code || '')}</div>
                    ` : '<span class="text-gray-400">-</span>'}
                  </td>
                  <td class="text-gray-600">${escapeHtml(player.dealer_name || '-')}</td>
                  <td class="font-mono text-sm text-gray-500">${player.current_ip || player.login_ip || '-'}</td>
                  <td class="text-gray-500 text-sm">${formatShortDate(player.login_at)}</td>
                  <td class="text-gray-500 text-sm">${formatShortDate(player.last_activity)}</td>
                  <td class="text-center">
                    <div class="flex items-center justify-center gap-1">
                      <button onclick="viewPlayerDetail(${player.id})" class="btn btn-primary btn-xs" title="查看详情">
                        <i class="fas fa-eye"></i>
                      </button>
                      <button onclick="kickPlayerOffline(${player.id})" class="btn btn-danger btn-xs" title="强制踢线">
                        <i class="fas fa-sign-out-alt"></i>
                      </button>
                      <button onclick="sendMessageToPlayer(${player.id})" class="btn btn-info btn-xs" title="发送消息">
                        <i class="fas fa-envelope"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="card-footer">
          <div class="text-sm text-gray-500">
            共 <span class="font-semibold text-gray-800">${data.total || 0}</span> 名在线玩家
            ${data.stats?.activeTables ? `，分布在 <span class="font-semibold">${data.stats.activeTables}</span> 个桌台` : ''}
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-gray-400">
              <i class="fas fa-clock mr-1"></i>最后更新: ${new Date().toLocaleTimeString('zh-CN')}
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" id="autoRefreshOnline" onchange="toggleAutoRefresh(this.checked)">
              <span>自动刷新 (30秒)</span>
            </label>
          </div>
        </div>
      </div>
    `
  } catch (error) {
    container.innerHTML = `<div class="card">${showEmpty('exclamation-circle', '加载失败: ' + error.message)}</div>`
  }
}

// 搜索在线玩家
function searchOnlinePlayers() {
  const gameType = document.getElementById('onlineGameFilter')?.value || ''
  const search = document.getElementById('onlinePlayerSearch')?.value || ''
  loadOnlinePlayers(gameType, search)
}

// 导出在线玩家列表
async function exportOnlinePlayers() {
  showNotification('正在导出...', 'info')
  // TODO: 实现导出功能
  setTimeout(() => showNotification('导出功能开发中', 'warning'), 500)
}

// 发送消息给玩家
async function sendMessageToPlayer(playerId) {
  const message = prompt('请输入要发送的消息:')
  if (!message) return
  
  try {
    // TODO: 实现发送消息API
    showNotification('消息发送成功', 'success')
  } catch (error) {
    showNotification('发送失败', 'danger')
  }
}

// 自动刷新控制
let autoRefreshTimer = null
function toggleAutoRefresh(enabled) {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  if (enabled) {
    autoRefreshTimer = setInterval(() => {
      const gameType = document.getElementById('onlineGameFilter')?.value || ''
      const search = document.getElementById('onlinePlayerSearch')?.value || ''
      loadOnlinePlayers(gameType, search)
    }, 30000)
    showNotification('已开启自动刷新 (30秒)', 'success')
  }
}

async function kickPlayerOffline(playerId) {
  if (!confirm('确定要将该玩家踢下线吗?')) return
  
  try {
    await API.post(`/players/${playerId}/kick`, { reason: '管理员强制下线' })
    showNotification('玩家已被踢下线', 'success')
    loadOnlinePlayers(document.getElementById('onlineGameFilter')?.value || '')
  } catch (error) {
    showNotification('操作失败', 'danger')
  }
}

// ============================================
// 模块加载与导航
// ============================================

function loadModule(moduleName) {
  AppState.currentModule = moduleName
  
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active')
    if (item.dataset.module === moduleName) {
      item.classList.add('active')
    }
  })
  
  // 更新标题
  const config = PageConfig[moduleName]
  if (config) {
    document.getElementById('page-title').textContent = config.title
    document.getElementById('page-subtitle').textContent = config.subtitle
  }
  
  // 加载模块
  if (Modules[moduleName]) {
    Modules[moduleName]()
  } else {
    document.getElementById('content').innerHTML = showEmpty('cog', '模块开发中', '该功能模块正在开发中')
  }
}

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // 检查登录状态
  if (checkLoginStatus()) {
    // 已登录，显示主应用
    showMainApp()
  } else {
    // 未登录，显示登录页
    showLoginPage()
  }
  
  // 导航点击事件
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const module = item.dataset.module
      if (module) {
        loadModule(module)
        history.pushState(null, '', `#${module}`)
      }
    })
  })
  
  // 监听hash变化
  window.addEventListener('hashchange', () => {
    if (AppState.isLoggedIn) {
      const hash = window.location.hash.replace('#', '') || 'dashboard'
      loadModule(hash)
    }
  })
  
  // 登录表单回车提交
  document.getElementById('loginUsername')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('loginPassword').focus()
    }
  })
})
