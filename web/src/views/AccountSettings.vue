<template>
  <div class="settings-view">
    <!-- 参数配置 -->
    <div class="section-card">
      <h3 class="section-title">参数配置</h3>
      <el-form label-width="120px" class="config-form">
        <el-form-item label="农场巡查间隔">
          <el-input-number v-model="farmIntervalSec" :min="1" :max="3600" :step="1" />
          <span class="unit">秒 (最低1秒)</span>
        </el-form-item>
        <el-form-item label="好友巡查间隔">
          <el-input-number v-model="friendIntervalSec" :min="1" :max="3600" :step="1" />
          <span class="unit">秒 (最低1秒)</span>
        </el-form-item>
        <el-form-item label="指定种植作物">
          <el-select
            v-model="preferredSeedId"
            placeholder="自动选择(经验效率最高)"
            clearable
            filterable
            style="width: 260px"
            :loading="cropListLoading"
          >
            <el-option :value="0" label="自动选择(经验效率最高)" />
            <el-option :value="29999" label="白萝卜仙人 (疯狂种植白萝卜)" />
            <el-option
              v-for="item in cropList"
              :key="item.seedId"
              :value="item.seedId"
              :label="`Lv${item.unlockLevel} ${item.name} (${item.expPerHour}经验/时)`"
            >
              <span style="color: var(--text-muted); font-size: 11px; margin-right: 4px">Lv{{ item.unlockLevel }}</span>
              <span>{{ item.name }}</span>
              <span v-if="item.seasons > 1" style="color: var(--color-warning); font-size: 11px"> ×{{ item.seasons }}季</span>
              <span style="float: right; color: var(--text-muted); font-size: 12px">{{ item.expPerHour }} 经验/时</span>
            </el-option>
          </el-select>
          <span class="unit">清空则自动选择</span>
        </el-form-item>
        <el-form-item label="偷取作物黑名单">
          <el-select
            v-model="stealBlacklist"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择不偷取的作物 (多选)"
            style="width: 380px"
          >
            <el-option
              v-for="item in cropList"
              :key="item.id"
              :value="item.id"
              :label="item.name"
            />
          </el-select>
          <div class="unit">多选，选中的作物将不会被自动偷取</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 种植效率排行 -->
    <div class="section-card">
      <div class="section-header">
        <h3 class="section-title">种植效率排行</h3>
        <span class="section-hint">基于当前等级(Lv{{ userLevel }})可购买作物计算</span>
      </div>

      <el-table
        :data="ranking"
        stripe
        style="width: 100%"
        :header-cell-style="{ background: 'var(--bg-base)', color: 'var(--text-muted)', borderColor: 'var(--border)' }"
        :cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }"
        v-loading="rankingLoading"
      >
        <el-table-column label="排名" width="60" align="center">
          <template #default="{ $index }">
            <span :class="{ 'rank-star': $index === 0 }">{{ $index + 1 }}{{ $index === 0 ? ' ★' : '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="作物" width="120" align="center">
          <template #default="{ row }">
            {{ row.name }}<span v-if="row.seasons > 1" class="seasons-badge">×{{ row.seasons }}季</span>
          </template>
        </el-table-column>
        <el-table-column label="解锁等级" width="90" align="center">
          <template #default="{ row }">
            Lv{{ row.unlockLevel || '?' }}
          </template>
        </el-table-column>
        <el-table-column label="生长周期" width="130" align="center">
          <template #default="{ row }">
            <span>{{ formatGrowTime(row.totalTimeSec || row.growTimeSec) }}</span>
            <span v-if="row.regrowSec" class="regrow-hint">(含回生{{ formatGrowTime(row.regrowSec) }})</span>
          </template>
        </el-table-column>
        <el-table-column label="总经验" width="90" align="center">
          <template #default="{ row }">
            {{ row.totalExp || row.exp }}
          </template>
        </el-table-column>
        <el-table-column label="经验/小时" width="110" align="center">
          <template #default="{ row }">
            <span class="exp-value">{{ row.expPerHour }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAccountSnapshot, updateAccountConfig, getPlantRanking, getCropList, updateToggles } from '../api/index.js'

const props = defineProps({ uin: String })

const farmIntervalSec = ref(1)
const friendIntervalSec = ref(10)
const preferredSeedId = ref(29999)  // 29999 = 白萝卜仙人
const saving = ref(false)
const userLevel = ref(1)
const stealBlacklist = ref([])
const featureToggles = ref({})

const ranking = ref([])
const rankingLoading = ref(false)
const cropList = ref([])
const cropListLoading = ref(false)

async function fetchConfig() {
  try {
    const res = await getAccountSnapshot(props.uin)
    const data = res.data
    farmIntervalSec.value = Math.round((data.farmInterval || 1000) / 1000)
    friendIntervalSec.value = Math.round((data.friendInterval || 10000) / 1000)
    userLevel.value = data.userState?.level || 1
    // 显式判断，保留 0 表示自动选择
    preferredSeedId.value = data.preferredSeedId ?? 0
    
    // 加载黑名单
    featureToggles.value = data.featureToggles || {}
    stealBlacklist.value = featureToggles.value.stealBlacklist || []
  } catch (e) {
    console.error('获取配置失败:', e)
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await updateAccountConfig(props.uin, {
      farmInterval: farmIntervalSec.value * 1000,
      friendInterval: friendIntervalSec.value * 1000,
      preferredSeedId: preferredSeedId.value || 0,
    })
    
    // 保存黑名单到 featureToggles
    await updateToggles(props.uin, {
      ...featureToggles.value,
      stealBlacklist: stealBlacklist.value
    })

    ElMessage.success('配置已保存')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function fetchRanking() {
  rankingLoading.value = true
  try {
    const res = await getPlantRanking(userLevel.value)
    ranking.value = res.data || []
  } catch { /* */ } finally {
    rankingLoading.value = false
  }
}

async function fetchCropList() {
  cropListLoading.value = true
  try {
    const res = await getCropList()
    cropList.value = res.data || []
  } catch { /* */ } finally {
    cropListLoading.value = false
  }
}

function formatGrowTime(sec) {
  if (!sec) return '-'
  if (sec < 60) return `${sec}秒`
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return m > 0 ? `${h}小时${m}分` : `${h}小时`
}

onMounted(async () => {
  await fetchConfig()
  fetchRanking()
  fetchCropList()
})
</script>

<style scoped>
.section-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.section-hint {
  color: var(--accent);
  font-size: 13px;
}

.config-form :deep(.el-form-item__label) {
  color: var(--text-secondary);
}

.config-form :deep(.el-input-number) {
  width: 160px;
}

.unit {
  margin-left: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.rank-star {
  color: var(--color-warning);
  font-weight: 700;
}

.exp-value {
  color: var(--color-success);
  font-weight: 600;
}

.seasons-badge {
  display: inline-block;
  margin-left: 4px;
  font-size: 11px;
  color: var(--color-warning);
  font-weight: 600;
}

.regrow-hint {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.2;
}

/* 暗色表格 */
:deep(.el-table) {
  --el-table-bg-color: var(--bg-surface);
  --el-table-tr-bg-color: var(--bg-surface);
  --el-table-header-bg-color: var(--bg-base);
  --el-table-border-color: var(--border);
  --el-table-text-color: var(--text-secondary);
  --el-table-row-hover-bg-color: var(--bg-hover);
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background: var(--bg-base);
}

@media (max-width: 768px) {
  .section-card {
    padding: 14px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .config-form :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
