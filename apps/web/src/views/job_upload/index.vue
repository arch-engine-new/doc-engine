<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import UploadToolbar from "./UploadToolbar.vue";
import { demoNav, rememberDemoNav, resetDemo as resetDemoApi } from "../../services/demo-session";
import { dictLabel, errorMessage, http, loadDict, uploadJob, type DictItem } from "../../services/http";
import { CONFIRM_NEXT, type DocTypeView, type JobView, type TemplateView } from "../../services/types";

const jobs = ref<JobView[]>([]);
const statusDict = ref<DictItem[]>([]);
const statusFilter = ref("");
const error = ref("");
const busy = ref(false);
const selected = ref<JobView | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const docTypes = ref<DocTypeView[]>([]);
const templates = ref<TemplateView[]>([]);
const selectedDocTypeId = ref("");
const selectedTemplateId = ref("");

const filtered = computed(() => {
  if (!statusFilter.value) return jobs.value;
  return jobs.value.filter((job) => job.status === statusFilter.value);
});

const nextStatus = computed(() => {
  const status = selected.value?.status;
  if (!status) return "";
  return CONFIRM_NEXT[status] ?? "";
});

const currentPackId = computed(() => {
  const ctx = jobs.value[0];
  return ctx?.pack_id || demoNav.packId || "";
});

const currentProjectId = computed(() => {
  const ctx = jobs.value[0];
  return ctx?.project_id || demoNav.projectId || "";
});

const templatesForDocType = computed(() => {
  if (!selectedDocTypeId.value) return [];
  return templates.value.filter((t) => t.doc_type_id === selectedDocTypeId.value);
});

const hasMultipleTemplates = computed(() => templatesForDocType.value.length > 1);

const resolvedTemplateId = computed(() => {
  if (selectedTemplateId.value) return selectedTemplateId.value;
  return templatesForDocType.value[0]?.template_id ?? null;
});

const canUpload = computed(() => !!selectedDocTypeId.value && !busy.value);

function tagClass(status: string): string {
  if (status === "checking" || status === "previewed") return "ok";
  if (status === "pending" || status === "inspecting" || status === "extracting") return "warn";
  if (status === "failed") return "bad";
  return "";
}

function templateLabel(templateId: string | null): string {
  if (!templateId) return "—";
  const tpl = templates.value.find((t) => t.template_id === templateId);
  return tpl ? `${tpl.name} (${templateId})` : templateId;
}

function onDocTypeChange() {
  selectedTemplateId.value = templatesForDocType.value[0]?.template_id ?? "";
}

function rememberSelected(jobId?: string) {
  const id = jobId ?? selected.value?.job_id;
  selected.value = (id ? jobs.value.find((job) => job.job_id === id) : undefined) ?? jobs.value[0] ?? null;
}

async function loadUploadContext() {
  const packId = currentPackId.value;
  if (!packId) {
    docTypes.value = [];
    templates.value = [];
    selectedDocTypeId.value = "";
    selectedTemplateId.value = "";
    return;
  }
  const [dtRes, packRes] = await Promise.all([
    http<{ docTypes: DocTypeView[] }>(`/api/packs/${packId}/doc-types`),
    http<{ templates: TemplateView[] }>(`/api/packs/${packId}/templates`),
  ]);
  docTypes.value = dtRes.docTypes;
  templates.value = packRes.templates;
  if (selectedDocTypeId.value && !dtRes.docTypes.some((dt) => dt.doc_type_id === selectedDocTypeId.value)) {
    selectedDocTypeId.value = "";
    selectedTemplateId.value = "";
  } else if (selectedDocTypeId.value) {
    onDocTypeChange();
  }
}

async function load(preferId?: string) {
  const data = await http<{ jobs: JobView[] }>("/api/jobs");
  jobs.value = data.jobs;
  rememberSelected(preferId);
  await loadUploadContext();
}

async function ensureSeed() {
  statusDict.value = await loadDict("job_status");
  const data = await http<{ jobs: JobView[] }>("/api/jobs");
  if (data.jobs.length === 0) {
    await resetDemoApi();
  }
  await load();
}

function openFilePicker() {
  if (!selectedDocTypeId.value) {
    error.value = "请先选择文档类型";
    return;
  }
  fileInputRef.value?.click();
}

async function onFileSelected(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!selectedDocTypeId.value) {
    error.value = "请先选择文档类型";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const result = await uploadJob(file, {
      projectId: currentProjectId.value || undefined,
      packId: currentPackId.value || undefined,
      docTypeId: selectedDocTypeId.value,
      templateId: resolvedTemplateId.value || undefined,
    });
    rememberDemoNav({ jobId: result.job.job_id, traceId: result.job.trace_id });
    await load(result.job.job_id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function runFixture(kind: "ok" | "reversed") {
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

async function confirmNext() {
  if (!selected.value || !nextStatus.value) return;
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

async function resetDemo() {
  busy.value = true;
  error.value = "";
  try {
    await resetDemoApi();
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
      Walking Skeleton 主入口。夹具运行走 live /api。状态：uploaded → inspecting → extracting → checking → pending / previewed / failed。对话不改 Job.status。
    </p>
    <UploadToolbar
      :doc-types="docTypes"
      :templates-for-doc-type="templatesForDocType"
      :selected-doc-type-id="selectedDocTypeId"
      :selected-template-id="selectedTemplateId"
      :has-multiple-templates="hasMultipleTemplates"
      :resolved-template-id="resolvedTemplateId"
      :can-upload="canUpload"
      :busy="busy"
      :next-status="nextStatus"
      :status-dict="statusDict"
      :status-filter="statusFilter"
      :dict-label="dictLabel"
      :template-label="templateLabel"
      @update:selected-doc-type-id="selectedDocTypeId = $event"
      @update:selected-template-id="selectedTemplateId = $event"
      @update:status-filter="statusFilter = $event"
      @doc-type-change="onDocTypeChange"
      @open-file-picker="openFilePicker"
      @run-fixture="runFixture"
      @reset-demo="resetDemo"
      @confirm-next="confirmNext"
    >
      <template #file-input>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          hidden
          @change="onFileSelected"
        />
      </template>
    </UploadToolbar>
    <p v-if="error" class="sub error-text">{{ error }}</p>
    <section class="card">
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>状态</th>
            <th>trace_id</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="job in filtered"
            :key="job.job_id"
            class="clickable"
            :class="{ 'is-selected': selected?.job_id === job.job_id }"
            @click="selected = job"
          >
            <td>{{ job.file_name || job.job_id }}</td>
            <td>
              <span class="tag" :class="tagClass(job.status)">{{ dictLabel(statusDict, job.status) }}</span>
            </td>
            <td>
              <RouterLink :to="`/audit/${job.trace_id}`">{{ job.trace_id }}</RouterLink>
            </td>
            <td>
              <RouterLink :to="`/jobs/${job.job_id}/findings`">检查结果</RouterLink>
              ·
              <RouterLink :to="`/jobs/${job.job_id}/volume`">组卷</RouterLink>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="4">暂无任务。可上传资料或运行夹具。</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <StepChat :trace-id="selected?.trace_id" :step="selected?.status || 'inspecting'" />
</template>
