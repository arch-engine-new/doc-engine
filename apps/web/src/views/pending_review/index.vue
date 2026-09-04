<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import {
  confirmSignatureTask,
  errorMessage,
  fetchPendingSignatures,
  http,
  loadDict,
  type DictItem,
} from "../../services/http";
import type { JobView, ProposalView, ReceiptView, SignatureTaskView } from "../../services/types";
import SignatureConfirmDialog from "./SignatureConfirmDialog.vue";
import SignatureReviewPanel from "./SignatureReviewPanel.vue";
import WordingReviewPanel from "./WordingReviewPanel.vue";

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

    <WordingReviewPanel
      v-if="activeTab === 'wording'"
      :proposals="proposals"
      :jobs="jobs"
      :status-dict="statusDict"
      :selected="selected"
      :wording="wording"
      :busy="busy"
      :tag-class="tagClass"
      @select="selectRow"
      @update:wording="wording = $event"
      @save-wording="saveWording"
      @confirm="confirm"
    />

    <SignatureReviewPanel
      v-else
      :tasks="signatureTasks"
      :busy="busy"
      :tag-class="tagClass"
      :status-label="signatureStatusLabel"
      @confirm="openConfirmDialog"
    />

    <SignatureConfirmDialog
      v-if="confirmTarget"
      :task="confirmTarget"
      :signer-name="signerName"
      :busy="busy"
      @update:signer-name="signerName = $event"
      @submit="submitSignatureConfirm"
      @close="closeConfirmDialog"
    />
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
</style>
