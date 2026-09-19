<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { demoNav, ensureDemoSession, rememberDemoNav } from "../../services/demo-session";
import { dictLabel, errorMessage, http, loadDict, type DictItem } from "../../services/http";
import type { RuleFixtureView, RuleVersionView } from "../../services/types";

const route = useRoute();
const router = useRouter();

const title = ref("required(编号)");
const dslText = ref(JSON.stringify({ op: "required", field: "编号" }, null, 2));
const blocking = ref(true);
const version = ref<RuleVersionView | null>(null);
const fixtures = ref<RuleFixtureView[]>([]);
const passPayload = ref(JSON.stringify({ 编号: "SH-001" }, null, 2));
const failPayload = ref("{}");
const statusDict = ref<DictItem[]>([]);
const error = ref("");
const busy = ref(false);
const publishResult = ref("");
const traceId = ref("");

const packId = computed(() => String(route.params.id ?? ""));
const canPublish = computed(() => {
  const hasPass = fixtures.value.some((row) => row.kind === "pass" && row.last_result === "pass");
  const hasFail = fixtures.value.some((row) => row.kind === "fail" && row.last_result === "fail");
  return hasPass && hasFail && version.value?.status !== "published";
});
const statusValue = computed(() => version.value?.status ?? "draft");

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

async function hydrate() {
  statusDict.value = await loadDict("rule_status");
  const jobs = await http<{ jobs: { trace_id: string }[] }>("/api/jobs");
  traceId.value = jobs.jobs[0]?.trace_id ?? demoNav.traceId;
  const pack = await http<{ pack: { pack_id: string } }>(`/api/packs/${packId.value}`).catch(async (err: unknown) => {
    await ensureDemoSession();
    if (demoNav.packId && demoNav.packId !== packId.value) {
      await router.replace(`/packs/${demoNav.packId}/rules`);
    }
    throw err;
  });
  rememberDemoNav({ packId: pack.pack.pack_id, traceId: traceId.value });
}

async function saveDraft() {
  busy.value = true;
  error.value = "";
  publishResult.value = "";
  try {
    const result = await http<{ version: RuleVersionView }>("/api/rules/draft", {
      method: "POST",
      body: JSON.stringify({
        packId: packId.value,
        title: title.value,
        dsl: parseJson(dslText.value),
        blocking: blocking.value ? 1 : 0,
      }),
    });
    version.value = result.version;
    fixtures.value = [];
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function addFixture(kind: "pass" | "fail") {
  if (!version.value) return;
  busy.value = true;
  error.value = "";
  try {
    const payload = parseJson(kind === "pass" ? passPayload.value : failPayload.value);
    const result = await http<{ fixture: RuleFixtureView }>(`/api/rules/${version.value.version_id}/fixtures`, {
      method: "POST",
      body: JSON.stringify({ kind, payload }),
    });
    fixtures.value = [...fixtures.value.filter((row) => row.id !== result.fixture.id), result.fixture];
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function runFixtures() {
  if (!version.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ fixtures: RuleFixtureView[] }>(
      `/api/rules/${version.value.version_id}/run-fixtures`,
      { method: "POST" },
    );
    fixtures.value = result.fixtures;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function publish() {
  if (!version.value || !canPublish.value) return;
  busy.value = true;
  error.value = "";
  publishResult.value = "";
  try {
    const result = await http<{ ok: boolean; version?: RuleVersionView; reason?: string }>(
      `/api/rules/${version.value.version_id}/publish`,
      { method: "POST" },
    );
    if (result.ok && result.version) {
      version.value = result.version;
      publishResult.value = "已发布";
    } else {
      error.value = result.reason ?? "发布闸门未通过";
    }
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void hydrate().catch((err: unknown) => {
    error.value = errorMessage(err);
  });
});
</script>

<template>
  <div class="wrap">
    <h1>规则编辑与发布</h1>
    <p class="sub">
      DSL 子集：required / compare / regex / eq / all / any。缺正例或反例时 Publish 不可用。对话不能 publish。验收 A3。
    </p>
    <div class="row-actions">
      <span class="tag" :class="statusValue === 'published' ? 'ok' : ''">
        {{ dictLabel(statusDict, statusValue) }}
      </span>
      <span v-if="version" class="muted">{{ version.version_id }}</span>
    </div>
    <p v-if="error" class="sub">{{ error }}</p>
    <p v-if="publishResult" class="receipt">{{ publishResult }}</p>
    <section class="card">
      <h2 class="card-title">草稿</h2>
      <div class="field-grid">
        <label class="filter-label">标题 <input v-model="title" type="text" /></label>
        <label class="filter-label">
          <input v-model="blocking" type="checkbox" /> blocking
        </label>
      </div>
      <textarea v-model="dslText" class="wording-box" rows="8" />
      <div class="row-actions">
        <button class="btn" type="button" :disabled="busy" @click="saveDraft">保存草稿</button>
      </div>
    </section>
    <section class="card">
      <h2 class="card-title">夹具</h2>
      <p class="muted">正例 payload / 反例 payload。须各至少一条并 runFixtures 通过闸门才能发布。</p>
      <div class="field-grid">
        <label>
          正例
          <textarea v-model="passPayload" class="wording-box" rows="4" />
        </label>
        <label>
          反例
          <textarea v-model="failPayload" class="wording-box" rows="4" />
        </label>
      </div>
      <div class="row-actions">
        <button class="btn ghost" type="button" :disabled="busy || !version" @click="addFixture('pass')">
          添加正例
        </button>
        <button class="btn ghost" type="button" :disabled="busy || !version" @click="addFixture('fail')">
          添加反例
        </button>
        <button class="btn" type="button" :disabled="busy || !version" @click="runFixtures">跑夹具</button>
        <button class="btn" type="button" :disabled="busy || !canPublish" @click="publish">发布 published</button>
        <button class="btn ghost" type="button" disabled>发布（缺夹具）</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>kind</th>
            <th>last_result</th>
            <th>payload</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in fixtures" :key="row.id">
            <td>{{ row.kind }}</td>
            <td>
              <span class="tag" :class="row.last_result === 'pass' ? 'ok' : row.last_result === 'fail' ? 'bad' : ''">
                {{ row.last_result ?? "—" }}
              </span>
            </td>
            <td class="muted">{{ row.payload_json }}</td>
          </tr>
          <tr v-if="fixtures.length === 0">
            <td colspan="3">尚未添加夹具。</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <StepChat :trace-id="traceId" step="rule_draft" />
</template>
