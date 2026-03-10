# 项目状态：停止维护

因临近毕业，本作者需要把更多精力投入到毕设和论文中，所以本仓库停止维护更新。
如果你仍在使用v4.0.1版本，请不要种植新活动里的四格作物，会导致运行异常。

以下是完成度更高的项目：

- [Penty-d/qq-farm-bot-ui](https://github.com/Penty-d/qq-farm-bot-ui)

<div align="center">

# QQ-FARM-BOT

QQ 农场全自动挂机管理平台 — 多账号、可视化、实时控制

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![release](https://img.shields.io/badge/release-v2.0.0-green.svg)](package.json) [![node](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org) [![vue](https://img.shields.io/badge/vue-3.5-42b883.svg)](https://vuejs.org)

</div>

---

基于 Node.js + Vue 3 构建的 QQ 农场自动化工具，支持多账号同时管理，提供 Web 可视化面板，实现种植、收获、偷菜、任务领取、仓库出售等全流程自动化。


---

## 功能特性

### 农场自动化
- **自动收获** — 成熟作物即时收取
- **智能种植** — 根据经验/小时效率排名自动选择最优种子
- **自动施肥** — 种植后自动购买并施加肥料加速生长
- **自动除草 / 除虫 / 浇水** — 保持农场健康状态
- **自动任务** — 自动领取已完成的成长任务和每日任务奖励
- **自动出售** — 定时清理背包果实换取金币

### 好友系统
- **自动偷菜** — 智能检测好友成熟作物并偷取
- **智能预筛选** — 跳过无事可做的好友，减少无效请求
- **跨平台支持** — 适配微信与 QQ 平台（含 QQ 平台最新 `SyncAll` 协议）

### 定时汇报系统 (NEW)
- **整点汇报** — 每小时整点自动发送最近 1 小时收成统计
- **每日日报** — 每天 8:00 发送昨日经营汇总
- **多维统计** — 包含收获排行、偷菜排行、账号资产概览
- **失败重试** — 邮件发送失败自动进行 3 次阶梯式重试

### 多用户权限
- **管理员 / 普通用户** 两级角色
- 管理员可管理所有账号，普通用户仅能操作被授权的 QQ 号
- JWT 认证，Session 数据 AES-256-CBC 加密存储

### 可视化面板
- **仪表盘** — 总览所有账号状态（运行中 / 停止 / 异常）
- **账号主页** — 等级、金币、经验、今日统计、功能开关实时切换
- **统计图表** — 最近 24 小时收成走势图 & 最近 7 天经营日报表
- **土地详情** — 每块地的植物、生长阶段、剩余时间
- **种植效率排行** — 根据等级动态计算作物经验/小时排名（含多季作物）
- **实时日志** — WebSocket 推送 Bot 运行日志
- **深色 / 浅色主题** 一键切换
- **移动端适配** — 手机也能正常使用

---


## 技术栈

| 层 | 技术 |
|:---|:---|
| 后端 | Node.js + Express + Socket.io + WebSocket (ws) |
| 前端 | Vue 3 + Vite 6 + Element Plus + Vue Router + Pinia |
| 协议 | Protobuf (protobufjs) 编解码游戏消息 |
| 数据库 | SQLite (sql.js，纯 JS 无需 native 编译) |
| 邮件服务 | Nodemailer (支持 SMTP 发送汇报与掉线通知) |
| 认证 | 自实现 JWT (HMAC-SHA256) + SHA-256 密码哈希 |
| 加密 | AES-256-CBC 加密 Session 存储 |
| 实时通信 | Socket.io (前后端) + WebSocket (游戏服务器) |

---

## 项目结构

```
qq-farm-bot/
├── server/                  # 后端服务
│   ├── index.js             # 服务器入口 (Express + Socket.io)
│   ├── bot-instance.js      # Bot 实例 (核心农场逻辑)
│   ├── bot-manager.js       # Bot 管理器 (多账号调度)
│   ├── routes.js            # REST API 路由
│   ├── auth.js              # JWT 认证中间件
│   ├── database.js          # SQLite 数据库
│   └── qr-service.js        # QR 扫码登录服务
├── web/                     # 前端 (Vue 3 SPA)
│   └── src/
│       ├── views/           # 页面: 仪表盘/主页/土地/设置/日志/管理
│       ├── layouts/         # MainLayout (侧边栏 + 顶栏)
│       ├── stores/          # Pinia 状态管理 (auth/theme)
│       ├── api/             # Axios API 封装
│       └── socket/          # Socket.io 客户端
├── src/
│   ├── proto.js             # Protobuf 加载器
│   ├── config.js            # 游戏常量配置
│   └── gameConfig.js        # 植物/等级/物品配置解析
├── proto/                   # Protobuf 协议定义文件
├── gameConfig/              # 游戏数据 (Plant.json / ItemInfo.json / RoleLevel.json)
├── tools/                   # 辅助工具 (经验收益计算器)
├── docker-compose.yml       # Docker 生产环境配置 (直接拉取镜像)
├── docker-compose.dev.yml   # Docker 开发环境配置 (本地构建)
├── .github/workflows/       # GitHub Actions 工作流
│   ├── deploy.yml           # 自动部署到服务器配置
│   └── docker.yml           # Docker 镜像自动构建与推送配置
└── data/                    # 运行时数据 (SQLite 数据库文件)

```

---

## 快速开始

### 环境要求

- **Node.js** >= 16

### 安装

```bash
git clone https://github.com/sulimu/qq-farm-bot.git
cd qq-farm-bot

# 一键安装所有依赖 (后端 + 前端)
npm run setup
```

### 构建前端

```bash
npm run build:web
```

### 启动服务

```bash
npm start
```

服务器默认运行在 `http://localhost:3000`。

### 登录

首次启动会自动创建默认管理员账号：

| 用户名 | 密码 |
|:---:|:---:|
| `admin` | `admin123` |

> **请登录后立即修改默认密码！**

### 添加 QQ 账号

1. 登录 Web 管理面板
2. 点击「添加账号」
3. **扫码登录**：使用手机 QQ 扫描生成的二维码。
4. **Code 登录 (推荐)**：若扫码失效，可使用 F12 抓取 WSS `code` 手动填入。
5. 扫码/Code 成功后 Bot 自动启动，所有配置将自动持久化到数据库。

---

## Docker 部署

本项目提供了两种 Docker 部署方式，分别满足**小白用户快速体验**与**开发者本地调试**的需求。

### 1. 生产环境部署（面向普通用户，推荐）

直接拉取云端预编译好的镜像，实现秒级启动，无需在本地耗时编译环境。

1. 在你的服务器或本地新建一个目录，并下载本项目的 `docker-compose.yml` 文件。
2. （可选）编辑 `docker-compose.yml`，修改 `BOT_ENCRYPT_KEY` 为你的 32 位随机密钥（生产环境建议修改）。生成随机密钥：`openssl rand -hex 16`
3. 在该目录下运行：

```bash
docker compose up -d

```

启动完成后，访问 `http://你的IP:3000` 即可。

### 2. 开发环境部署（面向开发者）

如果你修改了项目源码，希望在本地通过 Docker 重新构建并测试效果，请使用 `docker-compose.dev.yml`。

1. 克隆完整代码库到本地。
2. 在项目根目录下运行：

```bash
docker compose -f docker-compose.dev.yml up -d --build

```

> 首次本地构建需要 2~5 分钟时间（包含下载基础镜像、安装依赖和前端打包）。

---

## GitHub Actions 自动化

本项目配置了完善的 GitHub Actions 工作流。

### 1. 自动打包发布到 DockerHub

当你推送代码并打上版本标签（如 `v2.0.0`）时，会自动触发 `.github/workflows/docker.yml`，构建跨平台镜像并推送到 DockerHub。

**配置你的专属构建流（如果你 Fork 了本仓库）：**

1. 在你的仓库 **Settings** -> **Secrets and variables** -> **Actions** 中添加：
* `DOCKERHUB_USERNAME`: 你的 DockerHub 用户名
* `DOCKERHUB_TOKEN`: 你的 DockerHub 访问令牌


2. 在 `docker-compose.yml` 中将镜像地址修改为你自己的：`image: 你的用户名/qq-farm-bot:latest`

### 2. 自动部署到服务器

配置后，每次 push 到 `main` 分支，服务器会自动拉取最新代码并使用 `docker-compose.dev.yml` 重启服务。

#### 服务器准备

在服务器上生成 SSH 密钥（如果已有可跳过）：

```bash
ssh-keygen -t ed25519 -C "deploy" -f ~/.ssh/id_ed25519 -N ""
```

将公钥添加到授权列表：

```bash
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

查看私钥（后面要用）：

```bash
cat ~/.ssh/id_ed25519
```

#### 配置 GitHub Secrets

进入仓库页面 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 4 个 Secret：

| Name | 值 |
|:---|:---|
| `SERVER_HOST` | 服务器公网 IP（如 `123.45.67.89`） |
| `SERVER_USER` | SSH 用户名（如 `root`） |
| `SERVER_PORT` | SSH 端口（通常 `22`） |
| `SERVER_SSH_KEY` | 服务器私钥（`cat ~/.ssh/id_ed25519` 的完整输出，包含 BEGIN 和 END 行） |

#### 自动部署工作流说明

`.github/workflows/deploy.yml` 会在推送 `main` 分支时自动执行以下脚本：

```yaml
          script: |
            cd /root/qq-farm-bot
            git pull origin main
            docker compose -f docker-compose.dev.yml down
            docker compose -f docker-compose.dev.yml up -d --build

```

> **注意：** 部署脚本中的 `/root/qq-farm-bot` 为默认服务器路径，请确保代码已 Clone 到该位置，或根据实际情况修改 Workflow 文件中的路径。

#### 推送并测试

```bash
git add -A
git commit -m "ci: 添加 GitHub Actions 自动部署"
git push
```

前往仓库 **Actions** 标签页查看部署状态。首次可能失败，请检查：
- Secrets 是否正确配置
- 服务器是否已添加公钥到 `authorized_keys`
- 项目路径是否正确


---

## 环境变量

| 变量 | 默认值 | 说明 |
|:---|:---|:---|
| `PORT` | `3000` | 服务端口 |
| `TZ` | `Asia/Shanghai` | 容器时区（影响日志与统计时间） |
| `JWT_SECRET` | 内置随机值 | JWT 签名密钥 |
| `BOT_ENCRYPT_KEY` | 内置默认值 | Session 加密密钥 |

#### 邮件汇报配置 (SMTP)
| 变量 | 示例 | 说明 |
|:---|:---|:---|
| `MAIL_HOST` | `smtp.qq.com` | SMTP 服务器地址 |
| `MAIL_PORT` | `465` | SMTP 端口 |
| `MAIL_USER` | `your-email@qq.com` | 发件人邮箱 |
| `MAIL_PASS` | `xxxx-xxxx-xxxx` | 邮箱授权码/密码 |

---


## 致谢

本项目在学习和开发过程中参考了以下优秀的开源项目，在此表示感谢：

- [linguo2625469/qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) — QQ 农场 Bot 核心实现
- [lkeme/QRLib](https://github.com/lkeme/QRLib) — QQ 扫码登录库
- [QianChenJun/qq-farm-bot](https://github.com/QianChenJun/qq-farm-bot) — QQ 农场 Bot 参考实现
- [Penty-d/qq-farm-bot-ui](https://github.com/Penty-d/qq-farm-bot-ui) — QQ 农场 Bot 多功能参考实现

---

## 免责声明

本项目仅供学习和研究用途，请勿用于任何商业用途或违反服务条款的行为。使用本项目造成的任何后果由使用者自行承担。

---

## 许可证

[MIT License](LICENSE)
