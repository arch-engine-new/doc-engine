<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { DictItem } from "../../services/http";
import type { JobView } from "../../services/types";
import { isSkillTrack } from "./skillConfirm";

defineProps<{
  jobs: JobView[];
  selectedJobId: string | null;
  statusDict: DictItem[];
  statusFilter: string;
  dictLabel: (items: DictItem[], value: string) => string;
}>();

const emit = defineEmits<{
  select: [job: JobView];
  "update:statusFilter": [value: string];
}>();

function tagClass(status: string): string {
  if (status === "checking" || status === "previewed" || status === "processed" || status === "checked") {
    return "ok";
  }
  if (
    status === "pending" ||
    status === "inspecting" ||
    status === "extracting" ||
    status === "drafting" ||
    status === "ready_to_confirm" ||
    status === "uploaded"
  ) {
    return "warn";
  }
  if (status === "failed" || status === "unreadable") return "bad";
  return "";
}
</script>

<template>
  <section class="card">
    <h2 class="card-title">任务列表</h2>
    <p class="row-actions">
      <label class="filter-label">
        状态
        <select
          :value="statusFilter"
          @change="emit('update:statusFilter', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部</option>
          <option v-for="item in statusDict" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>
    </p>
    <table>
      <thead>
        <tr>
          <th>文件</th>
          <th>track</th>
          <th>状态</th>
          <th>trace_id</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="job in jobs"
          :key="job.job_id"
          class="clickable"
          :class="{ 'is-selected': selectedJobId === job.job_id }"
          @click="emit('select', job)"
        >
          <td>{{ job.file_name || job.job_id }}</td>
          <td><span class="tag">{{ job.track || "legacy" }}</span></td>
          <td>
            <span class="tag" :class="tagClass(job.status)">{{ dictLabel(statusDict, job.status) }}</span>
          </td>
          <td>
            <RouterLink :to="`/audit/${job.trace_id}`">{{ job.trace_id }}</RouterLink>
          </td>
          <td>
            <template v-if="!isSkillTrack(job)">
              <RouterLink :to="`/jobs/${job.job_id}/findings`">检查结果</RouterLink>
              ·
              <RouterLink :to="`/jobs/${job.job_id}/volume`">组卷</RouterLink>
            </template>
            <span v-else class="muted">无 findings</span>
          </td>
        </tr>
        <tr v-if="jobs.length === 0">
          <td colspan="5">暂无任务。可上传资料或运行夹具。</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
