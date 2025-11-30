# 真人荷官视讯后台管理系统 V2.2.4

## 项目概述
- **名称**: Live Casino Admin System V2.2.4
- **目标**: 为真人视讯游戏平台提供完整的后台管理解决方案
- **技术栈**: Hono + Cloudflare Workers + D1 Database + TailwindCSS
- **核心模块**: 12个功能模块
- **数据库表**: 40+ 张
- **API接口**: 95+

## 🔗 项目地址
- **GitHub 仓库1**: https://github.com/CNWEN123/backstage-03C
- **GitHub 仓库2**: https://github.com/CNWEN123/backstage-03
- **在线预览**: https://3000-ipt2autgp1wpdz5497sag-2b54fc91.sandbox.novita.ai

## 🆕 V2.2.4 更新内容

### 1. 管理员IP白名单绑定 (新增)
- **上级给下级设置IP白名单**:
  - 管理员账号列表新增"IP白名单"管理入口
  - 支持IP地址或CIDR格式（如：192.168.1.100 或 192.168.1.0/24）
  - IP绑定启用/禁用切换
  - 支持设置 0.0.0.0/0 允许所有IP
  - 添加IP时记录创建人信息
  - API: `GET/POST/DELETE /api/admins/:id/ip-bindings`

### 2. 红利活动方案配置 (新增)
- **红利活动管理**:
  - 7种活动类型：注册红利、首存红利、续存红利、生日红利、VIP红利、每日红利、每周红利
  - 3种红利形式：固定金额、百分比、阶梯
  - **自动派发功能**：勾选后系统自动发放
  - **关联流水稽查方案**：每个活动可绑定不同的流水配置
  - 领取次数/间隔限制配置
  - 活动时间范围设置
  - VIP等级/玩家标签限制
  - 活动条款配置
  - API: `GET/POST/PUT/DELETE /api/bonus/activities`

### 3. 流水稽查配置 (新增)
- **流水配置管理**:
  - 3种配置类型：存款流水、红利流水、提款流水
  - 流水倍数配置（如：3倍流水）
  - 有效天数配置（如：7天有效）
  - **游戏贡献比例**：不同游戏计入流水的百分比
    - 百家乐、龙虎: 100%
    - 骰宝、轮盘: 50%
    - 牛牛: 80%
  - 最低/最高单注金额限制
  - 排除游戏类型配置
  - 默认配置设置
  - API: `GET/POST/PUT/DELETE /api/turnover/configs`

## 🔒 安全特性
- **SQL注入防护**: 使用参数化查询和白名单验证
- **XSS防护**: 前后端双重HTML转义
- **密码安全**: SHA-256哈希存储
- **输入验证**: ID/金额/分页等参数严格验证
- **金额限制**: 存款≤1000万，提款≤500万，调账≤1000万
- **二级密码**: 敏感操作需验证
- **IP白名单**: 管理员登录IP限制

## 功能模块

### 1. 仪表盘 (Dashboard)
- 实时 KPI 指标展示
- 今日投注/存款/提款统计
- 7天投注趋势图表
- 待处理任务提醒
- 快捷操作入口

### 2. 玩家控端 (Players)
- 玩家列表管理
- 在线玩家监控
- 玩家详情查看
- 玩家状态管理
- 玩家标签管理
- VIP等级/KYC状态

### 3. 层级控端 (Agents)
- 金字塔代理体系
- 代理列表管理
- 占成/洗码率配置
- 下级统计

### 4. 财务控端 (Finance)
- 提款审核
- 人工存款/提款
- 人工调账
- 资金流水
- 转账记录
- 手续费设置
- 收款方式管理

### 5. 注单控端 (Bets)
- 注单列表查询
- 高额注单标记
- 注单详情/作废
- 统计汇总

### 6. 红利与洗码 (Commission) - V2.2.4 升级
- **洗码方案管理**: 多方案、按游戏差异化费率
- **待审核洗码**: 批量审核
- **红利派发**: 6种红利类型、流水追踪、过期管理
- **红利活动 (新增)**: 活动配置、自动派发、流水方案关联
- **流水稽查**: 提款/红利/存款流水稽核
- **流水配置 (新增)**: 流水倍数、游戏贡献、有效期配置

### 7. 风险控端 (Risk)
- **风险预警**: 单注超限、套利嫌疑、连赢、IP异常
- **限红配置**: 游戏类型限红管理
- **风控规则配置**: 规则类型、触发条件、动作配置

### 8. 报表中心 (Reports)
- 日结报表
- 股东/代理/会员报表
- 游戏报表
- 洗码/转账报表
- 数据导出

### 9. 现场运营控端 (Studio)
- 桌台状态监控
- 荷官档案库
- 排班管理

### 10. 内容管理 (Content)
- 公告管理
- 轮播图管理
- 消息管理

### 11. 系统设置 (Settings) - V2.2.4 升级
- **个人信息**: 查看/编辑用户信息
- **修改密码**: 旧密码验证+新密码设置
- **2FA设置**: Google Authenticator 开关
- **IP白名单**: CRUD管理
- **管理员账号**: 管理员列表/新增/编辑/**IP白名单绑定**
- **角色权限**: 角色CRUD + 细化权限分配
- **操作日志**: 审计记录
- **登录日志**: 登录/登出记录

### 12. 认证系统 (Auth)
- 登录页面
- 8小时会话管理
- 用户信息显示
- 安全登出

## API 接口

### 管理员IP绑定 (V2.2.4 新增)
- `GET /api/admins/:id/ip-bindings` - 获取管理员IP白名单
- `POST /api/admins/:id/ip-bindings` - 添加IP绑定
- `DELETE /api/admins/:adminId/ip-bindings/:id` - 删除IP绑定
- `POST /api/admins/:adminId/ip-bindings/:id/toggle` - 切换IP状态

### 红利活动方案 (V2.2.4 新增)
- `GET /api/bonus/activities` - 红利活动列表
- `GET /api/bonus/activities/:id` - 活动详情
- `POST /api/bonus/activities` - 创建活动
- `PUT /api/bonus/activities/:id` - 更新活动
- `DELETE /api/bonus/activities/:id` - 删除活动
- `POST /api/bonus/activities/:id/toggle` - 切换活动状态

### 流水稽查配置 (V2.2.4 新增)
- `GET /api/turnover/configs` - 流水配置列表
- `GET /api/turnover/configs/:id` - 配置详情
- `POST /api/turnover/configs` - 创建配置
- `PUT /api/turnover/configs/:id` - 更新配置
- `DELETE /api/turnover/configs/:id` - 删除配置

### 红利与流水
- `GET /api/bonus/records` - 红利记录列表
- `POST /api/bonus/dispatch` - 派发红利
- `GET /api/turnover/audit` - 流水稽查记录
- `GET /api/turnover/rules` - 流水稽核配置（旧API兼容）

### 风控规则
- `GET /api/risk/rules` - 风控规则列表
- `POST /api/risk/rules` - 创建风控规则
- `PUT /api/risk/rules/:id` - 更新风控规则

### 权限管理
- `GET /api/permissions` - 权限定义列表（按分类）
- `GET /api/roles/:id` - 角色详情（含权限数组）
- `PUT /api/roles/:id` - 更新角色（含权限）

### 系统设置
- `GET /api/ip-whitelist` - IP白名单列表
- `POST /api/ip-whitelist` - 添加IP
- `PUT /api/ip-whitelist/:id` - 更新IP
- `DELETE /api/ip-whitelist/:id` - 删除IP
- `GET /api/login-logs` - 登录日志
- `GET /api/2fa/status/:adminId` - 2FA状态
- `POST /api/2fa/toggle` - 切换2FA

## 数据模型

### 新增表 (V2.2.4)
- `admin_ip_bindings` - 管理员IP白名单绑定
- `turnover_configs` - 流水稽查配置
- `bonus_activities` - 红利活动方案
- `bonus_claims` - 红利领取记录

### 已有表 (V2.2.3)
- `bonus_records` - 红利记录
- `permission_definitions` - 权限定义表

### 核心表
- `admins` - 管理员
- `admin_roles` - 角色权限
- `admin_role_bindings` - 角色绑定
- `players` - 玩家
- `agents` - 代理
- `deposits` - 存款
- `withdrawals` - 提款
- `transactions` - 交易流水
- `bets` - 投注记录
- `commission_schemes` - 洗码方案
- `risk_alerts` - 风险预警
- `risk_rules` - 风控规则
- `game_tables` - 游戏桌台
- `dealers` - 荷官
- `operation_logs` - 操作日志
- `ip_whitelist` - IP白名单

## 使用指南

### 管理员IP白名单设置
1. 进入 **系统设置 → 管理员账号**
2. 点击管理员记录后的 **盾牌图标**
3. 在弹窗中点击 **添加IP**
4. 输入IP地址（支持单IP或CIDR格式）
5. 添加后，该管理员只能从白名单IP登录

### 红利活动配置
1. 进入 **红利与洗码 → 红利活动**
2. 点击 **新增活动** 按钮
3. 选择活动类型和红利形式
4. 配置红利值、最高红利、最低存款等
5. **选择流水稽查配置** 关联流水要求
6. 勾选 **自动派发** 实现自动发放
7. 设置领取次数/间隔限制

### 流水配置管理
1. 进入 **红利与洗码 → 流水配置**
2. 点击 **新增配置** 按钮
3. 选择配置类型（存款/红利/提款）
4. 设置流水倍数和有效天数
5. 配置各游戏的贡献比例
6. 可设为该类型的默认配置

## 测试账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin888 | 超级管理员 |
| finance01 | finance123 | 财务主管 |
| risk01 | risk123 | 风控专员 |
| operator01 | operator123 | 运营专员 |

## 部署说明

### 本地开发
```bash
npm install
npx wrangler d1 migrations apply webapp-production --local
npm run build
pm2 start ecosystem.config.cjs
```

### Cloudflare 部署
```bash
npx wrangler d1 create webapp-production
npx wrangler d1 migrations apply webapp-production
npm run deploy
```

## 版本历史

### V2.2.4 (2025-11-30)
- 🔐 新增: 管理员IP白名单绑定（上级给下级设置）
- 🎁 新增: 红利活动方案配置（自动派发、关联流水方案）
- 📊 新增: 流水稽查配置（流水倍数、游戏贡献比例）
- 🗄️ 新增: 4张数据库表（admin_ip_bindings, turnover_configs, bonus_activities, bonus_claims）
- 📝 新增: 15+ API接口

### V2.2.3 (2025-11-30)
- 🎁 新增: 红利派发功能（6种红利类型、流水追踪）
- 📊 新增: 流水稽查模块
- ⚠️ 新增: 风控规则配置（规则CRUD、条件配置）
- 🔐 升级: 角色权限细化（60+子功能权限勾选树）
- 🔧 优化: 风控规则前后端数据格式统一

### V2.2.2 (2025-11-30)
- 移除: 系统设置下的"系统配置"标签
- 恢复: 8个系统设置子功能
- 新增: IP白名单CRUD API
- 新增: 登录日志API
- 新增: 2FA状态管理API

### V2.2.1 (2025-11-30)
- 修复: viewTransferDetail函数缺失
- 修复: 路由顺序问题
- 新增: player_transfers表迁移
- 新增: transfer_fee_settings表迁移

### V2.2.0 (2025-11-29)
- 完善: 数据页面和报表页面

---
**Last Updated**: 2025-11-30
**Version**: 2.2.4
