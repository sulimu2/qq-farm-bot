/**
 * Express REST API 路由 - 含认证与权限
 */

const express = require('express');
const router = express.Router();
const { botManager } = require('./bot-manager');
const db = require('./database');
const { signToken, hashPassword, authMiddleware, adminOnly, canAccessUin } = require('./auth');
const gameConfig = require('../src/gameConfig');

// ============================================================
//  认证 (不需要 token)
// ============================================================

/** POST /api/auth/login */
router.post('/auth/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ ok: false, error: '用户名和密码不能为空' });

        const user = db.getAdminUser(username);
        if (!user) return res.status(401).json({ ok: false, error: '用户名或密码错误' });

        const hash = hashPassword(password);
        if (hash !== user.password_hash) return res.status(401).json({ ok: false, error: '用户名或密码错误' });

        const token = signToken({
            id: user.id,
            username: user.username,
            role: user.role,
            allowedUins: user.allowed_uins || '',
        });
        res.json({
            ok: true,
            data: {
                token,
                user: { id: user.id, username: user.username, role: user.role, allowedUins: user.allowed_uins },
            },
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** POST /api/auth/register */
router.post('/auth/register', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ ok: false, error: '用户名和密码不能为空' });
        if (username.length < 2 || username.length > 20) return res.status(400).json({ ok: false, error: '用户名长度 2-20 位' });
        if (password.length < 4) return res.status(400).json({ ok: false, error: '密码至少4位' });
        if (db.getAdminUser(username)) return res.status(400).json({ ok: false, error: '用户名已存在' });

        db.createAdminUser({ username, passwordHash: hashPassword(password), role: 'user' });
        const user = db.getAdminUser(username);
        const token = signToken({
            id: user.id,
            username: user.username,
            role: user.role,
            allowedUins: '',
        });
        res.json({
            ok: true,
            data: {
                token,
                user: { id: user.id, username: user.username, role: user.role, allowedUins: '' },
            },
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** POST /api/auth/change-password */
router.post('/auth/change-password', authMiddleware, (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body || {};
        if (!oldPassword || !newPassword) return res.status(400).json({ ok: false, error: '缺少参数' });
        if (newPassword.length < 4) return res.status(400).json({ ok: false, error: '新密码至少4位' });

        const user = db.getAdminUserById(req.user.id);
        if (!user) return res.status(404).json({ ok: false, error: '用户不存在' });

        if (hashPassword(oldPassword) !== user.password_hash) {
            return res.status(400).json({ ok: false, error: '旧密码错误' });
        }

        db.updateAdminUser(user.id, { password_hash: hashPassword(newPassword) });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/auth/me */
router.get('/auth/me', authMiddleware, (req, res) => {
    res.json({ ok: true, data: req.user });
});

// ============================================================
//  以下所有路由需要登录
// ============================================================
router.use(authMiddleware);

// ============================================================
//  账号列表
// ============================================================

/** POST /api/accounts/add-by-code - authCode 添加账号 (支持 QQ/微信) */
router.post('/accounts/add-by-code', async (req, res) => {
    try {
        const { code, uin: manualUin, platform, farmInterval, friendInterval } = req.body || {};
        if (!code) {
            return res.status(400).json({ ok: false, error: 'authCode 不能为空' });
        }

        const actualPlatform = platform || 'wx';
        let uin = manualUin;

        if (actualPlatform === 'wx' && !uin) {
            // 微信用户如果没有提供 uin，则自动生成随机唯一标识
            uin = 'wx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        }

        if (!uin) {
            return res.status(400).json({ ok: false, error: '账号标识 (UIN) 不能为空' });
        }

        // 创建或更新用户记录
        let user = db.getUserByUin(uin);
        if (!user) {
            db.createUser({ uin, platform: actualPlatform, farmInterval: farmInterval || 10000, friendInterval: friendInterval || 10000 });
        } else {
            db.updateUser(uin, { platform: actualPlatform });
        }

        // 保存 session
        db.saveSession(uin, code);

        // 启动 bot 时复用 DB 的已有配置（特别是功能开关、日统计及间隔等，防止参数被重置为空）
        user = db.getUserByUin(uin);
        const startOpts = { platform: actualPlatform };
        if (user) {
            if (user.feature_toggles) startOpts.featureToggles = JSON.parse(user.feature_toggles);
            if (user.daily_stats) startOpts.dailyStats = JSON.parse(user.daily_stats);
            if (user.daily_reward_state) startOpts.dailyRewardState = JSON.parse(user.daily_reward_state);
            startOpts.preferredSeedId = user.preferred_seed_id || 0;

            // 如果前端没有明确传入指定值，则保留 DB 中已有的值
            startOpts.farmInterval = farmInterval || user.farm_interval || 10000;
            startOpts.friendInterval = friendInterval || user.friend_interval || 10000;
        }

        await botManager._startBot(uin, code, startOpts);

        // 普通用户添加账号时，自动绑定到该用户
        if (req.user.role !== 'admin') {
            const adminUser = db.getAdminUserById(req.user.id);
            if (adminUser) {
                const currentUins = (adminUser.allowed_uins || '').split(',').map(s => s.trim()).filter(Boolean);
                if (!currentUins.includes(uin)) {
                    currentUins.push(uin);
                    db.updateAdminUser(adminUser.id, { allowed_uins: currentUins.join(',') });
                }
            }
        }

        res.json({ ok: true, data: { uin } });

        // 通知前端刷新账号列表（使用脱敏列表广播给未鉴权客户端）
        const io = req.app.locals.io;
        if (io) {
            const { maskAccountsPublic } = require('./account-utils');
            io.emit('accounts:list', maskAccountsPublic(botManager.listAccounts()));
        }
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** GET /api/accounts */
router.get('/accounts', (req, res) => {
    try {
        let accounts = botManager.listAccounts();

        // 获取当前用户的信息和权限列表
        const adminUser = db.getAdminUserById(req.user.id);
        const allowed = (adminUser?.allowed_uins || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const isAdmin = req.user.role === 'admin';
        const allowedSet = new Set(allowed);
        const hasAllowed = (targetUin) => {
            if (allowedSet.has(targetUin)) return true;
            if (targetUin && targetUin.startsWith('wx_')) {
                const stripped = targetUin.slice(3);
                if (allowedSet.has(stripped)) return true;
            } else if (targetUin) {
                if (allowedSet.has('wx_' + targetUin)) return true;
            }
            return false;
        };

        accounts = accounts.map(a => {
            // 判定是否为本人账号（管理员视为拥有所有账号）
            const isOwn = isAdmin || hasAllowed(a.uin);
            const isWx = a.platform === 'wx' || (a.uin && a.uin.startsWith('wx_'));

            // 头像：QQ用户用QQ头像API，微信用户用默认头像
            const avatarUrl = isWx
                ? 'https://q1.qlogo.cn/g?b=qq&nk=0&s=100'
                : `https://q1.qlogo.cn/g?b=qq&nk=${a.uin}&s=100`;

            // 显示标识：QQ用户显示QQ号，微信用户显示 "微信用户"
            const displayUin = isWx ? '微信用户' : a.uin;

            if (isOwn) {
                return {
                    ...a,
                    isOwn: true,
                    displayUin,
                    avatar: avatarUrl
                };
            } else {
                const maskedUin = isWx ? '微信用户' : (a.uin.slice(0, 3) + '****' + a.uin.slice(-2));
                const maskedNick = a.nickname ? a.nickname.charAt(0) + '***' : '隐藏用户';

                return {
                    ...a,
                    uin: a.uin, // 保留真实uin用于前端key和路由
                    displayUin: maskedUin,
                    nickname: maskedNick,
                    isOwn: false,
                    avatar: avatarUrl
                };
            }
        });

        // 排序逻辑：自己的账号排在最前面
        accounts.sort((a, b) => (b.isOwn ? 1 : 0) - (a.isOwn ? 1 : 0));

        res.json({ ok: true, data: accounts });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
/** GET /api/accounts/:uin */
router.get('/accounts/:uin', canAccessUin, (req, res) => {
    try {
        const account = botManager.getAccount(req.params.uin);
        if (!account) return res.status(404).json({ ok: false, error: '账号不存在' });
        res.json({ ok: true, data: account });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  账号详细数据 (需要 Bot 在运行)
// ============================================================

/** GET /api/accounts/:uin/lands - 土地详细状态 */
router.get('/accounts/:uin/lands', canAccessUin, async (req, res) => {
    try {
        const bot = botManager.bots.get(req.params.uin);
        if (!bot || bot.status !== 'running') {
            return res.status(400).json({ ok: false, error: 'Bot 未运行' });
        }
        const data = await bot.getDetailedLandStatus();
        if (!data) return res.status(500).json({ ok: false, error: '获取土地数据失败' });
        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/accounts/:uin/snapshot - 获取详细快照 (含功能开关、统计) */
router.get('/accounts/:uin/snapshot', canAccessUin, (req, res) => {
    try {
        const bot = botManager.bots.get(req.params.uin);
        if (!bot) {
            // 从 DB 返回基础信息
            const user = db.getUserByUin(req.params.uin);
            if (!user) return res.status(404).json({ ok: false, error: '账号不存在' });
            return res.json({
                ok: true, data: {
                    userId: user.uin, status: 'stopped',
                    userState: { name: user.nickname, level: user.level, gold: user.gold, exp: user.exp, gid: user.gid },
                    featureToggles: user.feature_toggles ? JSON.parse(user.feature_toggles) : null,
                    dailyStats: user.daily_stats ? JSON.parse(user.daily_stats) : null,
                    preferredSeedId: user.preferred_seed_id || 0,
                }
            });
        }
        res.json({ ok: true, data: bot.getSnapshot() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** PUT /api/accounts/:uin/toggles - 更新功能开关 */
router.put('/accounts/:uin/toggles', canAccessUin, (req, res) => {
    try {
        const bot = botManager.bots.get(req.params.uin);
        if (!bot) return res.status(400).json({ ok: false, error: 'Bot 未运行' });
        bot.setFeatureToggles(req.body || {});
        res.json({ ok: true, data: bot.featureToggles });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  种植效率排行
// ============================================================

/** GET /api/plant-ranking?level=25 */
router.get('/plant-ranking', (req, res) => {
    try {
        const level = parseInt(req.query.level) || 1;
        const ranking = gameConfig.getPlantRanking({ level, sort: 'expPerHour' });
        res.json({ ok: true, data: ranking });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/crop-list — 返回全部作物列表，按解锁等级升序排序（用于作物选择下拉框） */
router.get('/crop-list', (req, res) => {
    try {
        const list = gameConfig.getPlantRanking({ sort: 'unlockLevel' });
        res.json({ ok: true, data: list });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  QR 扫码登录
// ============================================================

/** POST /api/accounts/:uin/qr-login (Frontend is currently isolating this feature) */
router.post('/accounts/:uin/qr-login', async (req, res) => {
    try {
        const { uin } = req.params;
        const { platform, farmInterval, friendInterval } = req.body || {};
        const result = await botManager.startQrLogin(uin, { platform, farmInterval, friendInterval });

        // 普通用户添加账号时，自动绑定到该用户
        if (req.user.role !== 'admin') {
            const adminUser = db.getAdminUserById(req.user.id);
            if (adminUser) {
                const currentUins = (adminUser.allowed_uins || '').split(',').map(s => s.trim()).filter(Boolean);
                if (!currentUins.includes(uin)) {
                    currentUins.push(uin);
                    db.updateAdminUser(adminUser.id, { allowed_uins: currentUins.join(',') });
                }
            }
        }

        res.json({ ok: true, data: result });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** POST /api/accounts/:uin/qr-cancel */
router.post('/accounts/:uin/qr-cancel', canAccessUin, (req, res) => {
    try {
        botManager.cancelQrLogin(req.params.uin);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  Bot 启停
// ============================================================

/** POST /api/accounts/:uin/start */
router.post('/accounts/:uin/start', canAccessUin, async (req, res) => {
    try {
        await botManager.restartBot(req.params.uin);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** POST /api/accounts/:uin/stop */
router.post('/accounts/:uin/stop', canAccessUin, async (req, res) => {
    try {
        await botManager.stopBot(req.params.uin);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  账号配置
// ============================================================

/** PUT /api/accounts/:uin/config */
router.put('/accounts/:uin/config', canAccessUin, (req, res) => {
    try {
        botManager.updateAccountConfig(req.params.uin, req.body || {});
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** DELETE /api/accounts/:uin (管理员或账号拥有者) */
router.delete('/accounts/:uin', canAccessUin, async (req, res) => {
    try {
        await botManager.removeAccount(req.params.uin);

        // 如果是普通用户，从其 allowed_uins 中移除
        if (req.user.role !== 'admin') {
            const adminUser = db.getAdminUserById(req.user.id);
            if (adminUser) {
                const currentUins = (adminUser.allowed_uins || '').split(',').map(s => s.trim()).filter(Boolean);
                const updated = currentUins.filter(u => u !== req.params.uin);
                db.updateAdminUser(adminUser.id, { allowed_uins: updated.join(',') });
            }
        }

        // 广播更新后的账号列表给所有客户端（脱敏）
        const io = req.app.locals.io;
        if (io) {
            const { maskAccountsPublic } = require('./account-utils');
            io.emit('accounts:list', maskAccountsPublic(botManager.listAccounts()));
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  日志
// ============================================================

/** GET /api/accounts/:uin/logs?limit=100 */
router.get('/accounts/:uin/logs', canAccessUin, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = botManager.getBotLogs(req.params.uin, limit);
        res.json({ ok: true, data: logs });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/accounts/:uin/statistics?hours=24 */
router.get('/accounts/:uin/statistics', canAccessUin, (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const stats = db.getHourlyStatistics(req.params.uin, hours);
        res.json({ ok: true, data: stats });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/accounts/:uin/daily-statistics?days=7 */
router.get('/accounts/:uin/daily-statistics', canAccessUin, (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = db.getDailyStatistics(req.params.uin, days);
        res.json({ ok: true, data: stats });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  管理员: 邮件通知设置
// ============================================================

/** GET /api/admin/settings/mail */
router.get('/admin/settings/mail', adminOnly, (req, res) => {
    try {
        res.json({ ok: true, data: db.getMailSettings() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** PUT /api/admin/settings/mail */
router.put('/admin/settings/mail', adminOnly, (req, res) => {
    try {
        const { mailTo, mailEnabled } = req.body || {};
        db.saveMailSettings(mailTo, mailEnabled);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  管理员: 用户管理
// ============================================================

/** GET /api/admin/users */
router.get('/admin/users', adminOnly, (req, res) => {
    try {
        const users = db.getAllAdminUsers();
        res.json({ ok: true, data: users });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** POST /api/admin/users */
router.post('/admin/users', adminOnly, (req, res) => {
    try {
        const { username, password, role = 'user', allowedUins = '' } = req.body || {};
        if (!username || !password) return res.status(400).json({ ok: false, error: '用户名和密码不能为空' });
        if (db.getAdminUser(username)) return res.status(400).json({ ok: false, error: '用户名已存在' });
        db.createAdminUser({ username, passwordHash: hashPassword(password), role, allowedUins });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** PUT /api/admin/users/:id */
router.put('/admin/users/:id', adminOnly, (req, res) => {
    try {
        const { role, allowedUins, password } = req.body || {};
        const updates = {};
        if (role !== undefined) updates.role = role;
        if (allowedUins !== undefined) updates.allowed_uins = allowedUins;
        if (password) updates.password_hash = hashPassword(password);
        db.updateAdminUser(parseInt(req.params.id), updates);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** DELETE /api/admin/users/:id */
router.delete('/admin/users/:id', adminOnly, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ ok: false, error: '不能删除自己' });
        db.deleteAdminUser(id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  公告
// ============================================================

/** GET /api/announcement */
router.get('/announcement', authMiddleware, (req, res) => {
    try {
        const announcement = db.getAnnouncement();
        res.json({ ok: true, data: announcement || null });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** PUT /api/announcement (管理员) */
router.put('/announcement', adminOnly, (req, res) => {
    try {
        const { title = '', content = '' } = req.body || {};
        if (!content.trim()) return res.status(400).json({ ok: false, error: '公告内容不能为空' });
        const announcement = db.saveAnnouncement({ title: title.trim(), content: content.trim() });
        // 通过 Socket.io 实时推送公告更新
        const io = req.app.locals.io;
        if (io) io.emit('announcement:update', announcement);
        res.json({ ok: true, data: announcement });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
//  汇报设置
// ============================================================

const { generateAndSendReport } = require('./report-service');

/** GET /api/admin/settings/report */
router.get('/admin/settings/report', adminOnly, (req, res) => {
    try {
        const settings = db.getReportSettings();
        res.json({ ok: true, data: settings });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** PUT /api/admin/settings/report */
router.put('/admin/settings/report', adminOnly, (req, res) => {
    try {
        const { hourlyEnabled, dailyEnabled } = req.body || {};
        db.saveReportSettings(!!hourlyEnabled, !!dailyEnabled);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** POST /api/admin/report/test - 手动触发测试汇报 */
router.post('/admin/report/test', adminOnly, async (req, res) => {
    try {
        const { type = 'hourly' } = req.body || {};
        await generateAndSendReport(type, true); // true = 强制发送（忽略 enabled 设置）
        res.json({ ok: true, message: '测试汇报已发送' });
    } catch (err) {
        console.error('[API 测试汇报失败]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
