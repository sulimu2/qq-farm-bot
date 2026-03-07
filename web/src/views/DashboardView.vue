<template>
  <div class="dashboard-view">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon icon-blue">
          <el-icon :size="24"><User /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ accounts.length }}</div>
          <div class="stat-label">总账号</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-green">
          <el-icon :size="24"><CircleCheck /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ runningCount }}</div>
          <div class="stat-label">运行中</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-red">
          <el-icon :size="24"><Warning /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ errorCount }}</div>
          <div class="stat-label">异常</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-grey">
          <el-icon :size="24"><Remove /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stoppedCount }}</div>
          <div class="stat-label">已停止</div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="toolbar">
      <el-button type="primary" :icon="Plus" @click="showQrDialog = true">添加账号</el-button>
    </div>

    <!-- 账号列表 -->
    <div class="account-grid">
      <div
        v-for="acc in accounts"
        :key="acc.uin"
        class="account-card"
        :class="{ 'not-own': !acc.isOwn }"
        @click="acc.isOwn && router.push(`/account/${acc.uin}`)"
        :style="{ cursor: acc.isOwn ? 'pointer' : 'default' }"
      >
        <div class="acc-header">
          <img 
    class="acc-avatar" 
    :src="acc.avatar" 
    :alt="acc.isOwn ? acc.uin : '隐藏账号'" 
  />
          <div class="acc-header-info">
            <div class="acc-header-top">
              <span class="acc-uin">{{ acc.nickname || acc.uin }}</span>
              <div class="acc-status-dot" :class="acc.status" />
            </div>
            <div class="acc-sub">{{ acc.displayUin || acc.uin }}</div>
          </div>
        </div>
        <div class="acc-details">
          <span v-if="acc.level">Lv{{ acc.level }}</span>
          <span v-if="acc.gold" class="gold">{{ formatNum(acc.gold) }} 金币</span>
        </div>
        <div class="acc-footer">
          <el-tag :type="statusType(acc.status)" size="small" round effect="dark">
            {{ statusText(acc.status) }}
          </el-tag>
          <div class="acc-actions" v-if="acc.isOwn" @click.stop>
            <el-button
              v-if="acc.status !== 'running'"
              type="success" size="small" plain circle
              :icon="VideoPlay"
              @click="handleStart(acc.uin)"
              title="启动"
            />
            <el-button
              v-if="acc.status === 'running'"
              type="warning" size="small" plain circle
              :icon="VideoPause"
              @click="handleStop(acc.uin)"
              title="停止"
            />
            <el-button
              type="danger" size="small" plain circle
              :icon="Delete"
              @click="handleDelete(acc.uin)"
              title="删除"
            />
          </div>
        </div>
      </div>

      <div v-if="accounts.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无账号" />
      </div>
    </div>

    <!-- QR 扫码登录对话框 -->
    <QrCodeDialog
      v-model:visible="showQrDialog"
      :qr-base64="qrBase64"
      :qr-status="qrStatus"
      :qr-uin="qrUin"
      :initial-uin="qrUin"
      @confirm="handleQrConfirm"
      @cancel="handleQrCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, VideoPlay, VideoPause, Delete } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth.js'
import { getAccounts, startBot, stopBot, deleteAccount, startQrLogin, cancelQrLogin, addAccountByCode } from '../api/index.js'
import { onEvent, offEvent } from '../socket/index.js'
import QrCodeDialog from '../components/QrCodeDialog.vue'

const router = useRouter()
const auth = useAuthStore()

const accounts = ref([])
const loading = ref(false)

const runningCount = computed(() => accounts.value.filter(a => a.status === 'running').length)
const errorCount = computed(() => accounts.value.filter(a => a.status === 'error').length)
const stoppedCount = computed(() => accounts.value.filter(a => a.status === 'stopped' || a.status === 'idle').length)

// QR Dialog
const showQrDialog = ref(false)
const qrBase64 = ref('')
const qrStatus = ref('idle')
const qrUin = ref('')


async function fetchAccounts() {
  loading.value = true
  try {
    const res = await getAccounts()
    accounts.value = res.data || []
  } catch { /* */ } finally {
    loading.value = false
  }
}

async function handleStart(uin) {
  // 无法复用 Session，显示 Code 登录框以便重新输入
  showQrDialog.value = true
  qrBase64.value = ''
  qrUin.value = uin
  qrStatus.value = 'idle'
}

async function handleStop(uin) {
  try { await stopBot(uin); ElMessage.success('已停止'); fetchAccounts() }
  catch (e) { ElMessage.error(e.message) }
}

async function handleDelete(uin) {
  try {
    await ElMessageBox.confirm(`确定删除账号 ${uin}？`, '确认', { type: 'warning' })
    await deleteAccount(uin); ElMessage.success('已删除'); fetchAccounts()
  } catch { /* cancel */ }
}

async function handleQrConfirm(form) {
  // 手动输入 authCode 模式 (支持 QQ/微信)
  if (form.manual && form.code) {
    try {
      await addAccountByCode({
        code: form.code,
        uin: form.uin,
        platform: form.platform,
        farmInterval: form.farmInterval,
        friendInterval: form.friendInterval,
      })
      ElMessage.success('账号添加成功')
      showQrDialog.value = false
      fetchAccounts()
    } catch (e) {
      ElMessage.error(e.message)
    }
    return
  }

  // 扫码登录模式
  qrUin.value = form.uin
  qrStatus.value = 'loading'
  try {
    const res = await startQrLogin(form.uin, {
      platform: form.platform,
      farmInterval: form.farmInterval,
      friendInterval: form.friendInterval,
    })
    qrBase64.value = res.data.qrBase64
    qrStatus.value = 'pending'
  } catch (e) {
    qrStatus.value = 'error'
    ElMessage.error(e.message)
  }
}

function handleQrCancel() {
  if (qrUin.value && qrStatus.value === 'pending') cancelQrLogin(qrUin.value).catch(() => {})
  showQrDialog.value = false
  qrStatus.value = 'idle'
}

function formatNum(n) { return n ? Number(n).toLocaleString() : '' }

function isOwnAccount(uin) {
  return auth.allowedUins.includes(uin)
}

function statusType(s) {
  return { running: 'success', error: 'danger', connecting: 'warning', 'qr-pending': 'warning' }[s] || 'info'
}
function statusText(s) {
  return { running: '运行中', error: '异常', connecting: '连接中', 'qr-pending': '扫码中', stopped: '已停止', idle: '空闲' }[s] || s
}

// Socket.io
function onStatusChange(data) {
  const idx = accounts.value.findIndex(a => a.uin === data.userId)
  if (idx >= 0) accounts.value[idx].status = data.newStatus
  else fetchAccounts()
}
function onQrScanned(data) {
  if (data.uin === qrUin.value) {
    qrStatus.value = 'scanned'
    setTimeout(() => { showQrDialog.value = false; fetchAccounts() }, 1500)
  }
}
function onQrExpired(data) {
  if (data.uin === qrUin.value) { qrStatus.value = 'error'; ElMessage.warning(data.reason || '二维码已过期') }
}

onMounted(() => {
  fetchAccounts()
  onEvent('bot:statusChange', onStatusChange)
  onEvent('qr:scanned', onQrScanned)
  onEvent('qr:expired', onQrExpired)
})
onUnmounted(() => {
  offEvent('bot:statusChange', onStatusChange)
  offEvent('qr:scanned', onQrScanned)
  offEvent('qr:expired', onQrExpired)
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow);
  transition: box-shadow 0.2s, background 0.2s;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.icon-blue { background: rgba(79,124,255,0.12); color: var(--accent); }
.stat-icon.icon-green { background: rgba(22,163,74,0.12); color: var(--color-success); }
.stat-icon.icon-red { background: rgba(220,38,38,0.12); color: var(--color-danger); }
.stat-icon.icon-grey { background: rgba(100,116,139,0.12); color: var(--text-muted); }

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
}

.toolbar {
  margin-bottom: 16px;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.account-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow);
}

.account-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.account-card.not-own {
  opacity: 0.55;
}

.account-card.not-own:hover {
  border-color: var(--border);
  box-shadow: var(--shadow);
  transform: none;
}

.acc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.acc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  flex-shrink: 0;
  object-fit: cover;
  background: var(--bg-hover);
}

.acc-header-info {
  flex: 1;
  min-width: 0;
}

.acc-header-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.acc-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}

.acc-status-dot.running { background: var(--color-success); }
.acc-status-dot.error { background: var(--color-danger); }
.acc-status-dot.connecting { background: var(--color-warning); }

.acc-uin {
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.acc-sub {
  color: var(--text-faint);
  font-size: 12px;
  margin-top: 2px;
}

.acc-details {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.acc-details .gold {
  color: var(--color-warning);
}

.acc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.acc-actions {
  display: flex;
  gap: 4px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 40px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-value {
    font-size: 20px;
  }

  .account-grid {
    grid-template-columns: 1fr;
  }
}
</style>
