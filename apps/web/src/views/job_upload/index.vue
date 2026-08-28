<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { demoNav, rememberDemoNav, resetDemo as resetDemoApi } from "../../services/demo-session";
import { dictLabel, errorMessage, http, loadDict, uploadJob, type DictItem } from "../../services/http";
import { CONFIRM_NEXT, type JobView } from "../../services/types";

const jobs = ref<JobView[]>([]);
const statusDict = ref<DictItem[]>([]);
const statusFilter = ref("");
const error = ref("");
const busy = ref(false);
const selected = ref<JobView | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const filtered = computed(() => {
  if (!statusFilter.value) return jobs.value;
  return jobs.value.filter((job) => job.status === statusFilter.value);
});

const nextStatus = computed(() => {
  const status = selected.value?.status;
  if (!status) return "";
  return CONFIRM_NEXT[status] ?? "";
});

function tagClass(status: string): string {
  if (status === "checking" || status === "previewed") return "ok";
  if (status === "pending" || status === "inspecting" || status === "extracting") return "warn";
  if (status === "failed") return "bad";
  return "";
}

function rememberSelected(jobId?: string) {
  const id = jobId ?? selected.value?.job_id;
  selected.value = (id ? jobs.value.find((job) => job.job_id === id) : undefined) ?? jobs.value[0] ?? null;
}

async function load(preferId?: string) {
  const data = await http<{ jobs: JobView[] }>("/api/jobs");
  jobs.value = data.jobs;
  rememberSelected(preferId);
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
  fileInputRef.value?.click();
}

async function onFileSelected(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  busy.value = true;
  error.value = "";
  try {
    const ctx = jobs.value[0];
    const result = await uploadJob(file, {
      projectId: ctx?.project_id || demoNav.projectId || undefined,
      packId: ctx?.pack_id || demoNav.packId || undefined,
      templateId: ctx?.template_id || demoNav.templateId || undefined,
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
    <div class="row-actions">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        hidden
        @change="onFileSelected"
      />
      <button class="btn" :disabled="busy" type="button" @click="openFilePicker">上传资料</button>
      <button class="btn ghost" :disabled="busy" type="button" @click="runFixture('ok')">运行合规夹具</button>
      <button class="btn ghost" :disabled="busy" type="button" @click="runFixture('reversed')">运行颠倒夹具</button>
      <button class="btn ghost" :disabled="busy" type="button" @click="resetDemo">重置演示</button>
      <button class="btn" :disabled="busy || !nextStatus" type="button" @click="confirmNext">
        同意下一步
        <template v-if="nextStatus">→ {{ dictLabel(statusDict, nextStatus) }}</template>
      </button>
      <label class="filter-label">
        状态
        <select v-model="statusFilter">
          <option value="">全部</option>
          <option v-for="item in statusDict" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>
    </div>
    <p v-if="error" class="sub">{{ error }}</p>
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
