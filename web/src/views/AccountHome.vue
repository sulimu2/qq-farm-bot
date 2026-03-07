<template>
  <div class="account-home" v-loading="loading">
    <!-- 用户信息卡片 -->
    <div class="user-profile-card">
      <img class="profile-avatar" :src="`https://q.qlogo.cn/headimg_dl?dst_uin=${uin}&spec=640&img_type=jpg`" :alt="uin" />
      <div class="profile-info">
        <div class="profile-name">{{ snapshot?.userState?.name || '-' }}</div>
        <div class="profile-uin">QQ: {{ uin }}</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">等级</div>
        <div class="info-value level">Lv{{ snapshot?.userState?.level || 0 }}</div>
      </div>
      <div class="info-card">
        <div class="info-label">金币</div>
        <div class="info-value gold">{{ formatNum(snapshot?.userState?.gold) }}</div>
      </div>
      <div class="info-card">
        <div class="info-label">经验</div>
        <div class="info-value">{{ formatNum(snapshot?.userState?.exp) }}</div>
      </div>
    </div>
    
    <!-- 额外数据 (化肥/收藏点) -->
    <div class="extra-data-grid" v-if="snapshot?.userState?.fertilizer">
      <div class="extra-card">
        <div class="extra-card-header">
          <el-icon><Pouring /></el-icon> 化肥容器
        </div>
        <div class="extra-card-body">
          <div class="extra-item">
            <div class="extra-label">普通</div>
            <div class="extra-value">{{ (snapshot.userState.fertilizer.normal / 3600).toFixed(1) }}h</div>
          </div>
          <div class="extra-item">
            <div class="extra-label">有机</div>
            <div class="extra-value organic">{{ (snapshot.userState.fertilizer.organic / 3600).toFixed(1) }}h</div>
          </div>
        </div>
      </div>
      <div class="extra-card">
        <div class="extra-card-header">
          <el-icon><CollectionTag /></el-icon> 收藏点
        </div>
        <div class="extra-card-body">
          <div class="extra-item">
            <div class="extra-label">普通</div>
            <div class="extra-value">{{ snapshot.userState.collectionPoints?.normal || 0 }}</div>
          </div>
          <div class="extra-item">
            <div class="extra-label">典藏</div>
            <div class="extra-value classic">{{ snapshot.userState.collectionPoints?.classic || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 连接状态 -->
    <div class="status-bar">
      <el-tag :type="snapshot?.status === 'running' ? 'success' : 'danger'" effect="dark" size="small" round>
        {{ snapshot?.status === 'running' ? '已连接' : '未连接' }}
      </el-tag>
      <el-button v-if="snapshot?.status !== 'running'" type="primary" size="small" @click="handleStart">启动Bot</el-button>
      <el-button v-else type="warning" size="small" @click="handleStop">停止Bot</el-button>
      <span v-if="snapshot?.status === 'running' && uptime" class="uptime-text">
        ⭐ 挂机时长: {{ formatUptime(uptime) }}
      </span>
    </div>

    <!-- 功能开关 -->
    <div class="section-card" v-if="toggles">
      <h3 class="section-title">功能开关</h3>
      <div class="toggles-grid">
        <div class="toggle-group">
          <div class="toggle-group-title">自己农场</div>
          <div class="toggle-row">
            <span class="toggle-label">自动收获 <el-tooltip content="自动收取成熟作物" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoHarvest" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动种植 <el-tooltip content="收获后自动种植新作物" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoPlant" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动施肥 <el-tooltip content="种植后自动施肥加速" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoFertilize" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动除草 <el-tooltip content="自动清除杂草" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoWeed" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动除虫 <el-tooltip content="自动清除害虫" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoPest" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动浇水 <el-tooltip content="自动给干旱地块浇水" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoWater" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动解锁土地 <el-tooltip content="自动开拓新土地" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoLandUnlock" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动升级土地 <el-tooltip content="自动升级已有土地等级" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoLandUpgrade" @change="saveToggles" />
          </div>
          <div v-if="toggles.autoLandUpgrade" class="toggle-row sub-row">
            <span class="toggle-label">最高升级至</span>
            <el-select v-model="toggles.landUpgradeTarget" size="small" @change="saveToggles" style="width: 120px">
              <el-option :value="1" label="红土地" />
              <el-option :value="2" label="黑土地" />
              <el-option :value="3" label="金土地" />
              <el-option :value="4" label="紫土地" />
              <el-option :value="5" label="翡翠土地" />
              <el-option :value="6" label="蓝宝石土地" />
            </el-select>
          </div>
        </div>

        <div class="toggle-group">
          <div class="toggle-group-title">好友巡查</div>
          <div class="toggle-row">
            <span class="toggle-label">好友巡查 <el-tooltip content="定时访问好友农场" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.friendVisit" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动偷菜 <el-tooltip content="偷取好友成熟作物" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoSteal" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">不偷白萝卜 <el-tooltip content="开启后偷菜时跳过白萝卜" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.skipStealRadish" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">帮忙操作 <el-tooltip content="帮好友浇水除草" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.friendHelp" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">放虫放草 <el-tooltip content="给好友放置害虫和杂草" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.friendPest" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">经验满也帮忙 <el-tooltip content="开启后，帮好友浇水/除草/除虫时即使当日经验次数已达上限也继续操作；关闭则经验满后跳过" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.helpEvenExpFull" @change="saveToggles" />
          </div>
        </div>

        <div class="toggle-group">
          <div class="toggle-group-title">系统</div>
          <div class="toggle-row">
            <span class="toggle-label">自动任务 <el-tooltip content="自动领取已完成任务" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoTask" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动出售 <el-tooltip content="自动出售背包中果实" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoSell" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">自动购买肥料 <el-tooltip content="施肥时自动购买肥料" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoBuyFertilizer" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">图鉴奖励 <el-tooltip content="自动领取可用的图鉴奖励" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoIllustrated" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">点券购买化肥 <el-tooltip content="用点券自动购买有机化肥" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoFertilizerBuy" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">使用化肥礼包 <el-tooltip content="自动使用化肥礼包填充容器" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoFertilizerUse" @change="saveToggles" />
          </div>
        </div>

        <div class="toggle-group">
          <div class="toggle-group-title">每日奖励</div>
          <div class="toggle-row">
            <span class="toggle-label">商城免费礼包 <el-tooltip content="自动领取商城免费商品" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoFreeGifts" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">分享奖励 <el-tooltip content="自动完成分享并领取奖励" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoShareReward" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">月卡奖励 <el-tooltip content="自动领取月卡每日奖励" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoMonthCard" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">邮箱奖励 <el-tooltip content="自动领取邮件附件奖励" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoEmailReward" @change="saveToggles" />
          </div>
          <div class="toggle-row">
            <span class="toggle-label">QQ会员奖励 <el-tooltip content="自动领取QQ会员每日礼包" placement="top"><el-icon :size="14"><QuestionFilled /></el-icon></el-tooltip></span>
            <el-switch v-model="toggles.autoVipGift" @change="saveToggles" />
          </div>
        </div>
      </div>
    </div>

    <!-- 今日统计 -->
    <div class="section-card" v-if="stats">
      <div class="section-header">
        <h3 class="section-title">今日统计</h3>
        <span class="section-date">{{ stats.date }}</span>
      </div>
      <div class="stats-detail-grid">
        <div class="stat-detail">
          <div class="stat-detail-icon">🌟</div>
          <div>
            <div class="stat-detail-value">{{ stats.expGained }}</div>
            <div class="stat-detail-label">获得经验</div>
          </div>
        </div>
        <div class="stat-detail">
          <div class="stat-detail-icon">🌾</div>
          <div>
            <div class="stat-detail-value">{{ stats.harvestCount }}</div>
            <div class="stat-detail-label">收获次数</div>
          </div>
        </div>
        <div class="stat-detail">
          <div class="stat-detail-icon">🥬</div>
          <div>
            <div class="stat-detail-value">{{ stats.stealCount }}</div>
            <div class="stat-detail-label">偷菜次数</div>
          </div>
        </div>
        <div class="stat-detail">
          <div class="stat-detail-icon">💧</div>
          <div>
            <div class="stat-detail-value">{{ stats.helpWater }}</div>
            <div class="stat-detail-label">帮浇水</div>
          </div>
        </div>
        <div class="stat-detail">
          <div class="stat-detail-icon">🌿</div>
          <div>
            <div class="stat-detail-value">{{ stats.helpWeed }}</div>
            <div class="stat-detail-label">帮除草</div>
          </div>
        </div>
        <div class="stat-detail">
          <div class="stat-detail-icon">💰</div>
          <div>
            <div class="stat-detail-value">{{ stats.sellGold }}</div>
            <div class="stat-detail-label">出售金币</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!snapshot && !loading" class="empty-state">
      <el-empty description="暂无数据，请先启动 Bot" />
    </div>

    <!-- QR 扫码登录对话框 -->
    <QrCodeDialog
      v-model:visible="qrDialogVisible"
      :qr-base64="qrBase64"
      :qr-status="qrStatus"
      :qr-uin="props.uin"
      :initial-uin="props.uin"
      @confirm="handleQrConfirm"
      @cancel="handleQrCancel"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAccountSnapshot, updateToggles, startBot, stopBot, startQrLogin, cancelQrLogin, addAccountByCode } from '../api/index.js'
import { onEvent, offEvent } from '../socket/index.js'
import QrCodeDialog from '../components/QrCodeDialog.vue'

const props = defineProps({ uin: String })

const loading = ref(false)
const snapshot = ref(null)
const toggles = ref(null)
const stats = ref(null)
const uptime = ref(0)
let uptimeTimer = null

// QR 扫码登录状态
const qrDialogVisible = ref(false)
const qrBase64 = ref('')
const qrStatus = ref('idle') // idle | loading | pending | scanned | error

async function fetchData() {
  loading.value = true
  try {
    const res = await getAccountSnapshot(props.uin)
    snapshot.value = res.data
    toggles.value = res.data.featureToggles ? { ...res.data.featureToggles } : null
    stats.value = res.data.dailyStats || null
    // 初始化挂机时长
    if (res.data.startedAt) {
      uptime.value = Date.now() - res.data.startedAt
      startUptimeTimer(res.data.startedAt)
    } else {
      uptime.value = 0
      stopUptimeTimer()
    }
  } catch { /* */ } finally {
    loading.value = false
  }
}

function startUptimeTimer(startedAt) {
  stopUptimeTimer()
  uptimeTimer = setInterval(() => {
    uptime.value = Date.now() - startedAt
  }, 1000)
}

function stopUptimeTimer() {
  if (uptimeTimer) {
    clearInterval(uptimeTimer)
    uptimeTimer = null
  }
}

async function saveToggles() {
  try {
    await updateToggles(props.uin, toggles.value)
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}

async function handleStart() {
  // 无法复用 Session，点击启动直接弹出 Code 登录框
  qrDialogVisible.value = true
  qrBase64.value = ''
  qrStatus.value = 'idle'
}

async function handleQrConfirm(form) {
  // 手动输入 authCode 模式
  if (form.manual && form.code) {
    qrStatus.value = 'loading'
    try {
      await addAccountByCode({
        code: form.code,
        uin: form.uin,
        platform: form.platform,
        farmInterval: form.farmInterval,
        friendInterval: form.friendInterval,
      })
      ElMessage.success('登录成功')
      qrDialogVisible.value = false
      fetchData()
    } catch (e) {
      qrStatus.value = 'idle'
      ElMessage.error(e.message)
    }
    return
  }

  qrStatus.value = 'loading'
  try {
    const res = await startQrLogin(props.uin, {
      platform: form.platform,
      farmInterval: form.farmInterval,
      friendInterval: form.friendInterval,
    })
    qrBase64.value = res.data.qrBase64
    qrStatus.value = 'pending'
  } catch (err) {
    qrStatus.value = 'error'
    ElMessage.error('获取二维码失败: ' + err.message)
  }
}

function handleQrCancel() {
  if (qrStatus.value === 'pending') {
    cancelQrLogin(props.uin).catch(() => {})
  }
  qrDialogVisible.value = false
  qrStatus.value = 'idle'
}

async function handleStop() {
  try { await stopBot(props.uin); ElMessage.success('已停止'); fetchData() }
  catch (e) { ElMessage.error(e.message) }
}

function formatNum(n) { return n ? Number(n).toLocaleString() : '0' }

function formatUptime(ms) {
  if (!ms || ms <= 0) return '0秒'
  const totalSecs = Math.floor(ms / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = totalSecs % 60
  const parts = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (mins > 0) parts.push(`${mins}分`)
  parts.push(`${secs}秒`)
  return parts.join('')
}

function onStateUpdate(data) {
  if (data.userId !== props.uin) return
  if (snapshot.value) {
    snapshot.value.status = data.status
    snapshot.value.userState = data.userState
    // 更新挂机时长
    if (data.startedAt) {
      uptime.value = Date.now() - data.startedAt
      startUptimeTimer(data.startedAt)
    } else if (data.status !== 'running') {
      uptime.value = 0
      stopUptimeTimer()
    }
  }
}

function onQrScanned(data) {
  if (data.uin === props.uin) {
    qrStatus.value = 'scanned'
    ElMessage.success('扫码成功，正在登录...')
    setTimeout(() => {
      qrDialogVisible.value = false
      fetchData()
    }, 1500)
  }
}

function onQrExpired(data) {
  if (data.uin === props.uin) {
    qrStatus.value = 'error'
    ElMessage.warning(data.reason || '二维码已过期')
  }
}

function onQrError(data) {
  if (data.uin === props.uin) {
    qrStatus.value = 'error'
    ElMessage.error(data.reason || '扫码出错')
  }
}

onMounted(() => {
  fetchData()
  timer = setInterval(fetchData, 5000)
  onEvent('bot:stateUpdate', onStateUpdate)
  onEvent('qr:scanned', onQrScanned)
  onEvent('qr:expired', onQrExpired)
  onEvent('qr:error', onQrError)
})
onUnmounted(() => {
  offEvent('bot:stateUpdate', onStateUpdate)
  offEvent('qr:scanned', onQrScanned)
  offEvent('qr:expired', onQrExpired)
  offEvent('qr:error', onQrError)
  stopUptimeTimer()
})
</script>

<style scoped>
.user-profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid var(--border-strong);
  object-fit: cover;
  background: var(--bg-hover);
  flex-shrink: 0;
}

.profile-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.profile-uin {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.info-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
}

.info-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.info-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.info-value.gold { color: var(--color-warning); }
.info-value.level { color: var(--color-success); }
.info-value.name { font-size: 18px; }

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.uptime-text {
  font-size: 13px;
  color: var(--color-success);
  font-weight: 500;
  margin-left: auto;
  margin-right: 8px;
}

.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.section-date {
  color: var(--text-muted);
  font-size: 13px;
}

/* 功能开关 */
.toggles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.toggle-group-title {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 12px;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.toggle-label {
  font-size: 14px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-label .el-icon {
  color: var(--text-muted);
  cursor: help;
}

/* 今日统计 */
.stats-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-detail {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-detail-icon {
  font-size: 24px;
}

.stat-detail-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.stat-detail-label {
  font-size: 12px;
  color: var(--text-muted);
}

/* 额外数据 (化肥/收藏点) */
.extra-data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.extra-card {
  background: var(--bg-surface); 
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  color: var(--text);
  box-shadow: var(--shadow);
}

.extra-card-header {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-weight: 500;
}

.extra-card-header .el-icon {
  font-size: 16px;
  color: var(--color-primary);
}

.extra-card-body {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.extra-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.extra-label {
  font-size: 12px;
  color: var(--text-muted);
}

.extra-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.extra-value.organic {
  color: var(--color-success);
}

.extra-value.classic {
  color: var(--color-warning);
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
}

@media (max-width: 768px) {
  .user-profile-card {
    padding: 14px;
    gap: 12px;
  }

  .profile-avatar {
    width: 48px;
    height: 48px;
  }

  .profile-name {
    font-size: 17px;
  }

  .info-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .info-value {
    font-size: 18px;
  }

  .toggles-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .stats-detail-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .section-card {
    padding: 14px;
  }
}
.toggle-row.sub-row {
  margin-top: -8px;
  padding-left: 20px;
  margin-bottom: 8px;
}
.toggle-row.sub-row .toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
}

</style>
