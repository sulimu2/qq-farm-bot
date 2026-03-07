<template>
  <el-dialog
    v-model="dialogVisible"
    title="添加账号"
    :width="isMobile ? '92%' : '480px'"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- 扫码流程中（pending/scanned/error）不显示 tabs -->
    <template v-if="qrStatus === 'pending' || qrStatus === 'scanned' || qrStatus === 'error'">
      <!-- 显示二维码 -->
      <div v-if="qrStatus === 'pending'" class="qr-container">
        <div class="qr-hint">请使用 QQ 扫描下方二维码</div>
        <div class="qr-image-wrapper">
          <img v-if="qrBase64" :src="qrBase64" class="qr-image" alt="登录二维码" />
          <el-skeleton v-else :rows="0" animated style="width: 300px; height: 300px;" />
        </div>
        <div class="qr-tip">二维码有效时间约 3 分钟</div>
        <el-progress
          :percentage="qrCountdownPct"
          :stroke-width="4"
          :show-text="false"
          status="success"
          style="margin-top: 12px;"
        />
      </div>
      <!-- 扫码成功 -->
      <div v-else-if="qrStatus === 'scanned'" class="qr-container">
        <el-result icon="success" title="扫码成功" sub-title="正在登录游戏..." />
      </div>
      <!-- 错误状态 -->
      <div v-else-if="qrStatus === 'error'" class="qr-container">
        <el-result icon="error" title="扫码失败" sub-title="二维码已过期或出错，请重试">
          <template #extra>
            <el-button type="primary" @click="resetForm">重新获取</el-button>
          </template>
        </el-result>
      </div>
    </template>

    <!-- 初始状态：显示 tabs -->
    <template v-else>
      <el-tabs v-model="activeTab" stretch>
        <!-- <el-tab-pane label="QQ扫码登录" name="qr">
          <el-form :model="form" label-width="100px" @submit.prevent="handleSubmit">
            <el-form-item label="QQ号" required>
              <el-input
                v-model="form.uin"
                placeholder="请输入QQ号作为标识"
                :disabled="qrStatus === 'loading' || !!initialUin"
              />
            </el-form-item>
            <el-form-item label="农场巡查">
              <el-input-number
                v-model="form.farmIntervalSec"
                :min="1"
                :max="3600"
                :step="5"
                :disabled="qrStatus === 'loading'"
              />
              <span class="unit-text">秒</span>
            </el-form-item>
            <el-form-item label="好友巡查">
              <el-input-number
                v-model="form.friendIntervalSec"
                :min="1"
                :max="3600"
                :step="5"
                :disabled="qrStatus === 'loading'"
              />
              <span class="unit-text">秒</span>
            </el-form-item>
          </el-form>
        </el-tab-pane> -->

        <el-tab-pane label="Code 登录" name="manual">
          <el-form :model="manualForm" label-width="100px" @submit.prevent="handleManualSubmit">
            <el-form-item label="登录平台" required>
              <el-radio-group v-model="manualForm.platform">
                <el-radio label="qq">QQ</el-radio>
                <el-radio label="wx">微信</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="manualForm.platform === 'qq'" label="QQ号" required>
              <el-input v-model="manualForm.uin" placeholder="请输入QQ号" />
            </el-form-item>
            <el-form-item label="authCode" required>
              <el-input
                v-model="manualForm.authCode"
                placeholder="请粘贴 authCode (从 WSS URL 中获取)"
                type="textarea"
                :rows="2"
              />
            </el-form-item>
            <el-form-item label="农场巡查">
              <el-input-number v-model="manualForm.farmIntervalSec" :min="1" :max="3600" :step="5" />
              <span class="unit-text">秒</span>
            </el-form-item>
            <el-form-item label="好友巡查">
              <el-input-number v-model="manualForm.friendIntervalSec" :min="1" :max="3600" :step="5" />
              <span class="unit-text">秒</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </template>

    <template #footer>
      <template v-if="qrStatus === 'pending'">
        <el-button @click="handleClose">取消</el-button>
      </template>
      <template v-else-if="qrStatus === 'idle' || qrStatus === 'loading'">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          v-if="activeTab === 'qr'"
          type="primary"
          @click="handleSubmit"
          :loading="qrStatus === 'loading'"
          :disabled="!form.uin.trim()"
        >
          获取二维码
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="handleManualSubmit"
          :disabled="!manualForm.authCode.trim()"
        >
          添加账号
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed, onUnmounted } from 'vue'

const props = defineProps({
  visible: Boolean,
  qrBase64: String,
  qrStatus: String,
  qrUin: String,
  initialUin: String, // 预填的 QQ 号
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

// 移动端检测
const isMobile = ref(window.innerWidth <= 768)
function handleResize() {
  isMobile.value = window.innerWidth <= 768
}
window.addEventListener('resize', handleResize)
onUnmounted(() => window.removeEventListener('resize', handleResize))

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const activeTab = ref('manual')

const form = ref({
  uin: '',
  platform: 'qq',
  farmIntervalSec: 10,
  friendIntervalSec: 10,
})

const manualForm = ref({
  uin: '',
  authCode: '',
  platform: 'qq',
  farmIntervalSec: 10,
  friendIntervalSec: 10,
})

// 当对话框打开时，预填 uin
watch(() => props.visible, (visible) => {
  if (visible && props.initialUin) {
    form.value.uin = props.initialUin
    manualForm.value.uin = props.initialUin
  }
})

// QR 倒计时
const qrStartTime = ref(0)
const qrCountdownPct = ref(100)
let countdownTimer = null

watch(() => props.qrStatus, (status) => {
  if (status === 'pending') {
    qrStartTime.value = Date.now()
    startCountdown()
  } else {
    stopCountdown()
  }
})

function startCountdown() {
  stopCountdown()
  const TIMEOUT = 180000 // 3 分钟
  countdownTimer = setInterval(() => {
    const elapsed = Date.now() - qrStartTime.value
    qrCountdownPct.value = Math.max(0, 100 - (elapsed / TIMEOUT) * 100)
    if (elapsed >= TIMEOUT) stopCountdown()
  }, 500)
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

onUnmounted(stopCountdown)

function handleSubmit() {
  if (!form.value.uin.trim()) return
  // 如果是预填的已存在账号，且没有在界面上修改过，最好不要发送这些参数覆盖后端配置。
  // 但简单处理：如果不发送 farmInterval 和 friendInterval，后端会使用现有配置。
  const data = {
    uin: form.value.uin.trim(),
    platform: form.value.platform,
  }
  // 仅在手动输入新账号或真正想修改时才发送，但这里没有记录是否修改。
  // 把它们发送过去会导致覆盖。如果在 AccountHome 重新登入，我们只需不发送即可保持原有配置。
  if (!props.initialUin) {
    data.farmInterval = form.value.farmIntervalSec * 1000;
    data.friendInterval = form.value.friendIntervalSec * 1000;
  }
  emit('confirm', data)
}

function handleManualSubmit() {
  if (!manualForm.value.authCode.trim()) return
  if (manualForm.value.platform === 'qq' && !manualForm.value.uin.trim()) return
  
  const data = {
    uin: manualForm.value.uin.trim(),
    platform: manualForm.value.platform,
    code: manualForm.value.authCode.trim(),
    manual: true,
  }
  if (!props.initialUin) {
    data.farmInterval = manualForm.value.farmIntervalSec * 1000;
    data.friendInterval = manualForm.value.friendIntervalSec * 1000;
  }
  emit('confirm', data)
}

function handleClose() {
  emit('cancel')
  emit('update:visible', false)
}

function resetForm() {
  emit('update:visible', false)
  setTimeout(() => emit('update:visible', true), 200)
}
</script>

<style scoped>
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.qr-hint {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.qr-image-wrapper {
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 8px;
  background: #fff;
}

.qr-image {
  width: 280px;
  height: 280px;
  max-width: 100%;
  height: auto;
  display: block;
}

.qr-tip {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.unit-text {
  margin-left: 8px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .qr-image {
    width: 220px;
    height: auto;
  }

  .qr-container {
    padding: 8px 0;
  }
}
</style>
