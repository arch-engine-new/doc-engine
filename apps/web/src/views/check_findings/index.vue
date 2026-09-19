<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { dictLabel, errorMessage, http, loadDict, type DictItem } from "../../services/http";
import { prettyJson, type ExtractionView, type FindingView, type JobView } from "../../services/types";

const route = useRoute();
const router = useRouter();

const job = ref<JobView | null>(null);
const findings = ref<FindingView[]>([]);
const extraction = ref<ExtractionView | null>(null);
const retrieveDict = ref<DictItem[]>([]);
const error = ref("");
const busy = ref(false);

const jobId = computed(() => String(route.params.id ?? ""));

const hasBlocking = computed(() => findings.value.some((row) => row.blocking === 1));
const blocked = computed(() => findings.value.some((row) => row.blocking === 1 && row.result === "fail"));
const canConfirmPending = computed(() => job.value?.status === "checking");

function resultClass(result: string): string {
  if (result === "pass") return "ok";
  if (result === "fail") return "bad";
  return "warn";
}

interface ClauseBits {
  heading?: string;
  span?: unknown;
}

function clauseBits(detail: string | null): ClauseBits {
  if (!detail) return {};
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>;
      return { heading: rec.heading != null ? String(rec.heading) : undefined, span: rec.span };
    }
  } catch {
    return {};
  }
  return {};
}

function clauseCell(row: FindingView): string {
  if (!row.clause_id) return "—";
  const bits = clauseBits(row.detail);
  const pathLabel = row.retrieve_path ? dictLabel(retrieveDict.value, row.retrieve_path) : "";
  const parts = [row.clause_id];
  if (row.standard_version_id) parts.push(row.standard_version_id);
  if (pathLabel) parts.push(pathLabel);
  if (bits.heading) parts.push(bits.heading);
  if (bits.span != null) parts.push(`span ${prettyJson(bits.span)}`);
  return parts.join(" · ");
}

async function load() {
  error.value = "";
  const id = jobId.value;
  retrieveDict.value = await loadDict("retrieve_path");
  const listed = await http<{ jobs: JobView[] }>("/api/jobs");
  job.value = listed.jobs.find((row) => row.job_id === id) ?? null;
  try {
    const [findingRes, extractionRes] = await Promise.all([
      http<{ findings: FindingView[] }>(`/api/jobs/${id}/findings`),
      http<{ extraction: ExtractionView | null }>(`/api/jobs/${id}/extraction`),
    ]);
    findings.value = findingRes.findings;
    extraction.value = extractionRes.extraction;
    if (!job.value && findingRes.findings[0]) {
      job.value = listed.jobs.find((row) => row.job_id === findingRes.findings[0]!.job_id) ?? null;
    }
  } catch (err) {
    findings.value = [];
    extraction.value = null;
    error.value = errorMessage(err);
  }
}

async function confirmNext() {
  if (!job.value || !canConfirmPending.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ job: JobView }>(`/api/jobs/${job.value.job_id}/confirm-next`, {
      method: "POST",
    });
    job.value = { ...job.value, ...result.job };
    await router.push({ path: "/pending", query: { jobId: result.job.job_id } });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function exportJson() {
  const payload = {
    job: job.value,
    extraction: extraction.value,
    findings: findings.value,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `findings-${jobId.value}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  void load();
});

watch(jobId, () => {
  void load();
});
</script>

<template>
  <div class="wrap">
    <h1>检查结果</h1>
    <p class="sub">
      展示抽取 JSON 与规则命中。blocking 不得自动通过。标准符合度必须挂 clause_id，禁止把无条款号的命中写成「不合某条」。
    </p>
    <div class="row-actions">
      <button class="btn ghost" type="button" :disabled="!job" @click="exportJson">导出 JSON</button>
      <button class="btn" type="button" :disabled="busy || !canConfirmPending" @click="confirmNext">
        同意进入待审
      </button>
      <RouterLink v-if="job?.status === 'pending'" :to="{ path: '/pending', query: { jobId: job.job_id } }">
        去待审
      </RouterLink>
      <RouterLink v-if="job" :to="`/audit/${job.trace_id}`">trace {{ job.trace_id }}</RouterLink>
    </div>
    <p v-if="error" class="sub">{{ error }}</p>
    <p v-if="!job && !error" class="sub">未找到任务 {{ jobId }}。请从任务页打开检查结果。</p>

    <div v-if="hasBlocking" class="banner bad">
      存在 blocking 命中，Job 不得自动通过。对话不能取消 blocking。
    </div>
    <p v-if="job" class="sub">
      本页状态：
      <span class="tag" :class="blocked ? 'bad' : 'ok'">{{ blocked ? "blocked" : "pass" }}</span>
      · Job {{ job.status }}
    </p>

    <section class="card">
      <h2 class="card-title">抽取 JSON</h2>
      <pre class="extract">{{ prettyJson(extraction?.fields_json ?? extraction) }}</pre>
    </section>

    <section class="card">
      <h2 class="card-title">规则命中</h2>
      <table>
        <thead>
          <tr>
            <th>规则版本</th>
            <th>结果</th>
            <th>blocking</th>
            <th>不合哪条</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in findings" :key="row.finding_id">
            <td>
              <div>{{ row.rule_version_id }}</div>
              <div v-if="row.detail" class="muted">{{ row.detail }}</div>
            </td>
            <td>
              <span class="tag" :class="resultClass(row.result)">{{ row.result }}</span>
            </td>
            <td>
              <span class="tag" :class="row.blocking === 1 ? 'bad' : 'ok'">{{
                row.blocking === 1 ? "true" : "false"
              }}</span>
            </td>
            <td>{{ clauseCell(row) }}</td>
          </tr>
          <tr v-if="findings.length === 0">
            <td colspan="4">暂无 Finding。</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <StepChat :trace-id="job?.trace_id" step="checking" />
</template>
