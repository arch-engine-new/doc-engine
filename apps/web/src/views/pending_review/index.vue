<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import {
  confirmSignatureTask,
  dictLabel,
  errorMessage,
  fetchPendingSignatures,
  http,
  loadDict,
  type DictItem,
} from "../../services/http";
import type { JobView, ProposalView, ReceiptView, SignatureTaskView } from "../../services/types";

type PendingTab = "wording" | "signature";

const route = useRoute();

const activeTab = ref<PendingTab>("wording");
const proposals = ref<ProposalView[]>([]);
const signatureTasks = ref<SignatureTaskView[]>([]);
const jobs = ref<JobView[]>([]);
const statusDict = ref<DictItem[]>([]);
const selected = ref<ProposalView | null>(null);
const confirmTarget = ref<SignatureTaskView | null>(null);
const signerName = ref("");
const wording = ref("");
const error = ref("");
const busy = ref(false);
const lastReceipt = ref<ReceiptView | null>(null);
const adapterReceipt = ref<{ receipt_id: string; status: string } | null>(null);

const jobFilter = computed(() => {
  const value = route.query.jobId ?? route.query.job_id;
  return value ? String(value) : "";
});

const selectedJob = computed(() => {
  const id = selected.value?.job_id;
  if (!id) return null;
  return jobs.value.find((job) => job.job_id === id) ?? null;
});

const stepTraceId = computed(() => {
  if (activeTab.value === "signature" && signatureTasks.value[0]) {
    return signatureTasks.value[0].trace_id;
  }
  return selectedJob.value?.trace_id;
});

function tagClass(status: string): string {
  if (status === "confirmed" || status === "signed") return "ok";
  if (status === "pending") return "warn";
  if (status === "rejected") return "bad";
  return "";
}

function signatureStatusLabel(status: string): string {
  if (status === "pending") return "待签";
  if (status === "signed") return "已签";
  if (status === "rejected") return "已拒";
  return status;
}

function rememberSelected(id?: string) {
  const want = id ?? selected.value?.proposal_id;
  selected.value = (want ? proposals.value.find((row) => row.proposal_id === want) : undefined) ?? proposals.value[0] ?? null;
  wording.value = selected.value?.wording ?? "";
}

async function loadProposals(preferId?: string) {
  const query = jobFilter.value ? `?jobId=${encodeURIComponent(jobFilter.value)}` : "";
  const [proposalRes, jobRes] = await Promise.all([
    http<{ proposals: ProposalView[] }>(`/api/proposals${query}`),
    http<{ jobs: JobView[] }>("/api/jobs"),
  ]);
  proposals.value = proposalRes.proposals;
  jobs.value = jobRes.jobs;
  rememberSelected(preferId);
}

async function loadSignatures() {
  signatureTasks.value = await fetchPendingSignatures();
}

async function load(preferId?: string) {
  await loadProposals(preferId);
  if (activeTab.value === "signature") {
    await loadSignatures();
  }
}

async function switchTab(tab: PendingTab) {
  activeTab.value = tab;
  error.value = "";
  if (tab === "signature" && signatureTasks.value.length === 0) {
    busy.value = true;
    try {
      await loadSignatures();
    } catch (err) {
      error.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }
}

async function saveWording() {
  if (!selected.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ proposal: ProposalView }>(`/api/proposals/${selected.value.proposal_id}`, {
      method: "PATCH",
      body: JSON.stringify({ wording: wording.value }),
    });
    await loadProposals(result.proposal.proposal_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function confirm() {
  if (!selected.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ proposal: ProposalView; receipt: ReceiptView }>(
      `/api/proposals/${selected.value.proposal_id}/confirm`,
      { method: "POST" },
    );
    lastReceipt.value = result.receipt;
    await loadProposals();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function openConfirmDialog(task: SignatureTaskView) {
  confirmTarget.value = task;
  signerName.value = task.assignee_label ?? "";
  error.value = "";
}

function closeConfirmDialog() {
  confirmTarget.value = null;
  signerName.value = "";
}

async function submitSignatureConfirm() {
  if (!confirmTarget.value) return;
  const name = signerName.value.trim();
  if (!name) {
    error.value = "请填写签字人姓名";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const result = await confirmSignatureTask(confirmTarget.value.task_id, name);
    lastReceipt.value = result.receipt;
    closeConfirmDialog();
    await loadSignatures();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function probeMount() {
  busy.value = true;
  error.value = "";
  try {
    adapterReceipt.value = await http<{ receipt_id: string; status: string }>("/adapter/pending-mount", {
      method: "POST",
    });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function selectRow(row: ProposalView) {
  selected.value = row;
  wording.value = row.wording;
}

onMounted(() => {
  void (async () => {
    statusDict.value = await loadDict("proposal_status");
    await loadProposals();
  })().catch((err: unknown) => {
    error.value = errorMessage(err);
  });
});

watch(jobFilter, () => {
  void loadProposals().catch((err: unknown) => {
    error.value = errorMessage(err);
  });
});
</script>

<template>
  <div class="wrap">
    <h1>待审工作台</h1>
    <p class="sub">
      agent-runtime check_wording 只生成 Proposal（pending）。人确认后中台写 Receipt。无回执不算落库。对话不能确认、不能 submit。
    </p>
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'wording' }"
        type="button"
        @click="switchTab('wording')"
      >
        措辞待审
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'signature' }"
        type="button"
        @click="switchTab('signature')"
      >
        资料待签
      </button>
    </div>
    <div class="row-actions">
      <button class="btn ghost" type="button" :disabled="busy" @click="probeMount">探测 pending-mount</button>
      <RouterLink to="/jobs">返回任务</RouterLink>
    </div>
    <p v-if="error" class="sub">{{ error }}</p>
    <p v-if="lastReceipt" class="receipt">
      Receipt {{ lastReceipt.receipt_id }} · {{ lastReceipt.status }}
    </p>
    <p v-if="adapterReceipt" class="muted">
      适配器 pending-mount receipt_id={{ adapterReceipt.receipt_id }}（不是提案确认回执）
    </p>

    <template v-if="activeTab === 'wording'">
      <section class="card">
        <table>
          <thead>
            <tr>
              <th>提案</th>
              <th>Job</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in proposals"
              :key="row.proposal_id"
              class="clickable"
              :class="{ 'is-selected': selected?.proposal_id === row.proposal_id }"
              @click="selectRow(row)"
            >
              <td>{{ row.proposal_id }}</td>
              <td>
                <RouterLink :to="`/jobs/${row.job_id}/findings`">{{ row.job_id }}</RouterLink>
              </td>
              <td>
                <span class="tag" :class="tagClass(row.status)">{{ dictLabel(statusDict, row.status) }}</span>
              </td>
            </tr>
            <tr v-if="proposals.length === 0">
              <td colspan="3">暂无待审提案。可从检查页「同意进入待审」，或运行颠倒夹具后重置演示。</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="selected" class="card">
        <p>建议措辞（可改）：</p>
        <textarea v-model="wording" class="wording-box" rows="3" />
        <div class="row-actions">
          <button class="btn ghost" type="button" :disabled="busy" @click="saveWording">保存措辞</button>
          <button class="btn" type="button" :disabled="busy" @click="confirm">确认并开 Receipt</button>
        </div>
      </section>
    </template>

    <template v-else>
      <section v-if="signatureTasks.length === 0" class="card">
        <p class="muted">暂无待签资料。可在项目页生成并上传文档后查看。</p>
      </section>
      <section v-for="task in signatureTasks" :key="task.task_id" class="card sig-card">
        <div class="sig-head">
          <h2 class="card-title">{{ task.role }}</h2>
          <span class="tag" :class="tagClass(task.status)">{{ signatureStatusLabel(task.status) }}</span>
        </div>
        <dl class="sig-meta">
          <div>
            <dt>签认人</dt>
            <dd>{{ task.assignee_label || "—" }}</dd>
          </div>
          <div>
            <dt>资料</dt>
            <dd>
              <span class="mono">{{ task.artifact_id }}</span>
              <RouterLink class="sig-link" :to="`/audit/${task.trace_id}`">审计</RouterLink>
            </dd>
          </div>
        </dl>
        <div class="row-actions">
          <button
            class="btn"
            type="button"
            :disabled="busy || task.status !== 'pending'"
            @click="openConfirmDialog(task)"
          >
            确认签字
          </button>
        </div>
      </section>
    </template>

    <section v-if="confirmTarget" class="card dialog-panel">
      <p><strong>确认签字 — {{ confirmTarget.role }}</strong></p>
      <p class="muted">资料 {{ confirmTarget.artifact_id }}</p>
      <label class="filter-label">
        签字人姓名
        <input
          v-model="signerName"
          type="text"
          class="grow"
          placeholder="如：张监理"
          @keydown.enter.prevent="submitSignatureConfirm"
        />
      </label>
      <div class="row-actions">
        <button class="btn" type="button" :disabled="busy" @click="submitSignatureConfirm">提交签字</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeConfirmDialog">取消</button>
      </div>
    </section>
  </div>
  <StepChat :trace-id="stepTraceId" step="pending" />
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab-btn {
  background: transparent;
  border: 1px solid var(--apt-border);
  border-radius: var(--apt-radius-sm);
  color: var(--apt-text-muted);
  padding: 8px 14px;
  font-size: 13px;
}
.tab-btn.active {
  background: var(--apt-primary);
  border-color: var(--apt-primary);
  color: #fff;
  font-weight: 600;
}
.sig-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.sig-head .card-title {
  margin: 0;
}
.sig-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 0 12px;
}
.sig-meta div {
  margin: 0;
}
.sig-meta dt {
  color: var(--apt-text-muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.sig-meta dd {
  margin: 0;
  font-size: 13px;
}
.mono {
  font-family: var(--apt-font-mono), monospace;
  font-size: 12px;
}
.sig-link {
  margin-left: 8px;
  font-size: 12px;
}
@media (max-width: 720px) {
  .sig-meta {
    grid-template-columns: 1fr;
  }
}
</style>
