<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StepChat from "../../components/StepChat.vue";
import { demoNav, rememberDemoNav, resetDemo as resetDemoApi } from "../../services/demo-session";
import {
  confirmSkill,
  dictLabel,
  errorMessage,
  http,
  listJobs,
  loadDict,
  skillDryRun,
  uploadJob,
  type DictItem,
} from "../../services/http";
import {
  CONFIRM_NEXT,
  type DocTypeView,
  type JobView,
  type SkillCandidateView,
  type SkillSummaryView,
} from "../../services/types";
import JobListTable from "./JobListTable.vue";
import LegacyTrackPanel from "./LegacyTrackPanel.vue";
import UploadToolbar from "./UploadToolbar.vue";
import {
  canConfirmSkillUi,
  canUploadSkill as skillUploadEnabled,
  chatStepForJob,
  isSkillTrack,
  mergeJobLists,
  rememberCandidates,
  skillFileTag,
} from "./skillConfirm";

const jobs = ref<JobView[]>([]);
const statusDict = ref<DictItem[]>([]);
const statusFilter = ref("");
const error = ref("");
const busy = ref(false);
const selected = ref<JobView | null>(null);
const docTypes = ref<DocTypeView[]>([]);
const selectedDocTypeId = ref("");
const skillSummary = ref<SkillSummaryView | null>(null);
const skillCandidates = ref<SkillCandidateView[]>([]);
const selectedSkillId = ref("");
const fileTag = ref(skillFileTag());
const summariesByJob = new Map<string, SkillSummaryView>();
const candidatesByJob = new Map<string, SkillCandidateView[]>();
const selectedIdsByJob = new Map<string, string>();

const filtered = computed(() => {
  if (!statusFilter.value) return jobs.value;
  return jobs.value.filter((job) => job.status === statusFilter.value);
});

const nextStatus = computed(() => {
  const status = selected.value?.status;
  if (!status || isSkillTrack(selected.value)) return "";
  return CONFIRM_NEXT[status] ?? "";
});

const currentPackId = computed(() => jobs.value[0]?.pack_id || demoNav.packId || "");
const currentProjectId = computed(() => jobs.value[0]?.project_id || demoNav.projectId || "");

const canUploadSkill = computed(() =>
  skillUploadEnabled({ busy: busy.value, selectedDocTypeId: selectedDocTypeId.value }),
);
const canLegacyFixture = computed(() => !!selectedDocTypeId.value && !busy.value);
const canDryRun = computed(() => !busy.value && isSkillTrack(selected.value));
const canConfirm = computed(() => {
  if (busy.value || !isSkillTrack(selected.value)) return false;
  if (!canConfirmSkillUi(skillSummary.value)) return false;
  if (skillCandidates.value.length > 1 && !selectedSkillId.value) return false;
  return true;
});
const canConfirmNext = computed(() => !busy.value && !!nextStatus.value);
const chatStep = computed(() => chatStepForJob(selected.value));

function restoreSkillUi(job: JobView | null): void {
  const id = job?.job_id;
  skillSummary.value = id ? (summariesByJob.get(id) ?? null) : null;
  skillCandidates.value = id ? (candidatesByJob.get(id) ?? []) : [];
  selectedSkillId.value = id ? (selectedIdsByJob.get(id) ?? "") : "";
}

function rememberSelected(jobId?: string): void {
  const id = jobId ?? selected.value?.job_id;
  selected.value = (id ? jobs.value.find((job) => job.job_id === id) : undefined) ?? jobs.value[0] ?? null;
  restoreSkillUi(selected.value);
}

function selectJob(job: JobView): void {
  selected.value = job;
  restoreSkillUi(job);
}

function persistSkillPick(jobId: string, skillId: string): void {
  selectedSkillId.value = skillId;
  selectedIdsByJob.set(jobId, skillId);
}

async function loadUploadContext(): Promise<void> {
  const packId = currentPackId.value;
  if (!packId) {
    docTypes.value = [];
    selectedDocTypeId.value = "";
    return;
  }
  const dtRes = await http<{ docTypes: DocTypeView[] }>(`/api/packs/${packId}/doc-types`);
  docTypes.value = dtRes.docTypes;
  if (selectedDocTypeId.value && !dtRes.docTypes.some((dt) => dt.doc_type_id === selectedDocTypeId.value)) {
    selectedDocTypeId.value = "";
  }
}

async function load(preferId?: string): Promise<void> {
  const [legacyRes, skillRes] = await Promise.all([listJobs(), listJobs({ track: "skill" })]);
  jobs.value = mergeJobLists(legacyRes.jobs, skillRes.jobs);
  rememberSelected(preferId);
  await loadUploadContext();
}

async function ensureSeed(): Promise<void> {
  statusDict.value = await loadDict("job_status");
  const [legacyRes, skillRes] = await Promise.all([listJobs(), listJobs({ track: "skill" })]);
  if (legacyRes.jobs.length === 0 && skillRes.jobs.length === 0) {
    await resetDemoApi();
  }
  await load();
}

async function onSkillFile(file: File): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    const result = await uploadJob(file, {
      projectId: currentProjectId.value || undefined,
      packId: currentPackId.value || undefined,
    });
    fileTag.value = skillFileTag(file.name);
    rememberDemoNav({ jobId: result.job.job_id, traceId: result.job.trace_id });
    await load(result.job.job_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function runFixture(kind: "ok" | "reversed"): Promise<void> {
  if (!selectedDocTypeId.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ job: JobView }>("/api/jobs/fixture", {
      method: "POST",
      body: JSON.stringify({ kind }),
    });
    await load(result.job.job_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function confirmNext(): Promise<void> {
  if (!selected.value || !nextStatus.value || isSkillTrack(selected.value)) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ job: JobView }>(`/api/jobs/${selected.value.job_id}/confirm-next`, {
      method: "POST",
    });
    await load(result.job.job_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function runDryRun(): Promise<void> {
  if (!selected.value || !isSkillTrack(selected.value)) return;
  busy.value = true;
  error.value = "";
  try {
    const preview = await skillDryRun(selected.value.job_id, {
      selected_skill_id: selectedSkillId.value || undefined,
    });
    const rows = rememberCandidates(preview.candidates);
    skillCandidates.value = rows;
    candidatesByJob.set(selected.value.job_id, rows);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function runConfirmSkill(): Promise<void> {
  if (!selected.value || !canConfirm.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await confirmSkill(selected.value.job_id, {
      selected_skill_id: selectedSkillId.value || undefined,
    });
    await load(result.job.job_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function onSkillSummary(summary: SkillSummaryView): void {
  const id = selected.value?.job_id;
  if (!id || !isSkillTrack(selected.value)) return;
  skillSummary.value = summary;
  summariesByJob.set(id, summary);
}

async function resetDemo(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await resetDemoApi();
    summariesByJob.clear();
    candidatesByJob.clear();
    selectedIdsByJob.clear();
    fileTag.value = skillFileTag();
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void ensureSeed().catch((err: unknown) => {
    error.value = errorMessage(err);
  });
});
</script>

<template>
  <div class="wrap">
    <h1>上传与任务</h1>
    <p class="sub">
      默认表 Skill 轨：不选 DocType 也可上传。右侧对话只改草稿；引擎人话三块摘要出来后才能点「确认完成并处理」。确认进索引的检查项即该表生产规则。旧夹具走 legacy。
    </p>
    <UploadToolbar
      :can-upload-skill="canUploadSkill"
      :can-dry-run="canDryRun"
      :can-confirm="canConfirm"
      :file-tag="fileTag"
      :summary="skillSummary"
      :candidates="skillCandidates"
      :selected-skill-id="selectedSkillId"
      @upload-file="onSkillFile"
      @dry-run="runDryRun"
      @confirm-skill="runConfirmSkill"
      @update:selected-skill-id="selected && persistSkillPick(selected.job_id, $event)"
    />
    <LegacyTrackPanel
      :doc-types="docTypes"
      :selected-doc-type-id="selectedDocTypeId"
      :busy="busy"
      :can-legacy-fixture="canLegacyFixture"
      :can-confirm-next="canConfirmNext"
      :next-status="nextStatus"
      :next-status-label="dictLabel(statusDict, nextStatus)"
      @update:selected-doc-type-id="selectedDocTypeId = $event"
      @run-fixture="runFixture"
      @confirm-next="confirmNext"
      @reset-demo="resetDemo"
    />
    <p v-if="error" class="sub error-text">{{ error }}</p>
    <JobListTable
      :jobs="filtered"
      :selected-job-id="selected?.job_id ?? null"
      :status-dict="statusDict"
      :status-filter="statusFilter"
      :dict-label="dictLabel"
      @select="selectJob"
      @update:status-filter="statusFilter = $event"
    />
  </div>
  <StepChat :trace-id="selected?.trace_id" :step="chatStep" @skill-summary="onSkillSummary" />
</template>
