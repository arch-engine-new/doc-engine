<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { demoNav, ensureDemoSession, rememberDemoNav, resolveLivePackId } from "../../services/demo-session";
import {
  dictLabel,
  errorMessage,
  http,
  ingestStandardPdf,
  loadDict,
  tickStandardIngest,
  type DictItem,
} from "../../services/http";
import type { IngestTickPageView, RetrieveHitView, SpecPackView } from "../../services/types";
import HitDetailPanel from "./HitDetailPanel.vue";
import PdfTickPanel from "./PdfTickPanel.vue";
import RetrieveHitsTable from "./RetrieveHitsTable.vue";
import { runTickAll } from "./tick-all";

const LEAVE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const route = useRoute();
const router = useRouter();

const pack = ref<SpecPackView | null>(null);
const title = ref("员工请假说明");
const fileUri = ref("fixture://leave");
const ingestText = ref(LEAVE_TEXT);
const query = ref("1.1");
const hits = ref<RetrieveHitView[]>([]);
const selectedHit = ref<RetrieveHitView | null>(null);
const lastVersionId = ref("");
const lastClauses = ref<{ clause_id: string }[]>([]);
const tablesUnlinked = ref(0);
const edgeFrom = ref("");
const edgeTo = ref("");
const edgeKind = ref("");
const bindVersionId = ref("");
const edgeDict = ref<DictItem[]>([]);
const pathDict = ref<DictItem[]>([]);
const error = ref("");
const busy = ref(false);
const traceId = ref("");
const ingestRunId = ref("");
const tickPages = ref<IngestTickPageView[]>([]);
const tickDone = ref(false);

function ingestError(err: unknown): string {
  const raw = errorMessage(err);
  if (raw.includes("multipart file field required")) {
    return "没收到 PDF，请重新选择规范文件。";
  }
  if (raw.includes("pdf raster failed") || raw.includes("@napi-rs/canvas")) {
    return "这是扫描件，需要逐页识别。本机还不能把 PDF 页画成图。请改用能选中文字的 PDF，或把条文粘贴到上方文本框点「入库条款」。";
  }
  return raw;
}

// Mount StepChat on packId, not hits: empty retrieve still needs the HITL sidebar.
const packId = computed(() => String(route.params.id ?? ""));

async function loadPack(): Promise<void> {
  pathDict.value = await loadDict("retrieve_path");
  edgeDict.value = await loadDict("standard_edge_kind");
  if (edgeDict.value[0] && !edgeKind.value) edgeKind.value = edgeDict.value[0].value;
  // Pack-scoped thread — never listJobs()[0] (that is fixture-reversed.json).
  traceId.value = packId.value ? `pack:${packId.value}` : "";
  try {
    const res = await http<{ pack: SpecPackView }>(`/api/packs/${packId.value}`);
    pack.value = res.pack;
    error.value = "";
    bindVersionId.value = res.pack.effective_standard_version_id ?? "";
    lastVersionId.value = res.pack.effective_standard_version_id ?? "";
    lastClauses.value = [];
    rememberDemoNav({ packId: res.pack.pack_id, traceId: traceId.value });
  } catch (err) {
    const missingPack = errorMessage(err).includes("spec pack not found");
    if (missingPack) {
      const fallback = (await resolveLivePackId()) ?? "";
      if (fallback && fallback !== packId.value) {
        rememberDemoNav({ packId: fallback, traceId: `pack:${fallback}` });
        await router.replace(`/packs/${fallback}/standards`);
        return;
      }
    }
    await ensureDemoSession();
    if (demoNav.packId && demoNav.packId !== packId.value) {
      await router.replace(`/packs/${demoNav.packId}/standards`);
      return;
    }
    throw err;
  }
}

async function ingest(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{
      version: { version_id: string };
      clauses: { clause_id: string }[];
      tablesUnlinked?: number;
    }>("/api/standards/ingest", {
      method: "POST",
      body: JSON.stringify({
        packId: packId.value,
        title: title.value,
        fileUri: fileUri.value,
        text: ingestText.value,
      }),
    });
    lastVersionId.value = result.version.version_id;
    lastClauses.value = result.clauses;
    tablesUnlinked.value = result.tablesUnlinked ?? 0;
    bindVersionId.value = result.version.version_id;
    edgeFrom.value = result.clauses[1]?.clause_id ?? result.clauses[0]?.clause_id ?? "";
    edgeTo.value = result.clauses[0]?.clause_id ?? "";
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

/** 202 only registers pending pages; ticks consume them one at a time. */
async function onPdfSelected(file: File): Promise<void> {
  busy.value = true;
  error.value = "";
  tickDone.value = false;
  tickPages.value = [];
  ingestRunId.value = "";
  try {
    const started = await ingestStandardPdf(file, { packId: packId.value, title: title.value });
    ingestRunId.value = started.ingest_run_id;
  } catch (err) {
    error.value = ingestError(err);
  } finally {
    busy.value = false;
  }
}

async function applyOneTick(): Promise<{ done: boolean; status: string }> {
  const tick = await tickStandardIngest(ingestRunId.value);
  if (tick.page_no != null) {
    const rest = tickPages.value.filter((page) => page.page_no !== tick.page_no);
    tickPages.value = [...rest, { page_no: tick.page_no, status: tick.status }];
  }
  if (tick.done) tickDone.value = true;
  if (tick.error) error.value = ingestError(tick.error);
  return tick;
}

async function tickPage(): Promise<void> {
  if (!ingestRunId.value || tickDone.value) return;
  busy.value = true;
  error.value = "";
  try {
    await applyOneTick();
  } catch (err) {
    error.value = ingestError(err);
  } finally {
    busy.value = false;
  }
}

/** Busy wraps the whole serial loop; each tickFn is the existing one-page ingest. */
async function tickAllPages(): Promise<void> {
  if (!ingestRunId.value || tickDone.value) return;
  busy.value = true;
  error.value = "";
  try {
    await runTickAll(applyOneTick);
  } catch (err) {
    error.value = ingestError(err);
  } finally {
    busy.value = false;
  }
}

async function search(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ hits: RetrieveHitView[] }>("/api/standards/search", {
      method: "POST",
      body: JSON.stringify({ packId: packId.value, query: query.value }),
    });
    hits.value = result.hits;
    selectedHit.value = null; // new search closes detail; only a row click opens it
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function addEdge(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await http("/api/standards/edges", {
      method: "POST",
      body: JSON.stringify({ from: edgeFrom.value, to: edgeTo.value, kind: edgeKind.value }),
    });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function bindEffective(): Promise<void> {
  if (!bindVersionId.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ pack: SpecPackView }>(`/api/packs/${packId.value}/effective-version`, {
      method: "POST",
      body: JSON.stringify({ versionId: bindVersionId.value }),
    });
    pack.value = result.pack;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function reloadPack(): void {
  void loadPack().catch((err: unknown) => {
    error.value = errorMessage(err);
  });
}
watch(packId, reloadPack);
onMounted(reloadPack);
</script>

<template>
  <div class="wrap">
    <h1>标准库</h1>
    <p class="sub">
      请假说明夹具入库（用户自备标准，无行业预置）。命中列 file_name + 页 + unit_id；表 clause_id 显示 —。RAG 定位条款，不替代 DSL。验收 A11–A14。
    </p>
    <p v-if="error" class="sub">{{ error }}</p>
    <section class="card">
      <h2 class="card-title">摄入</h2>
      <div class="field-grid">
        <label class="filter-label">标题 <input v-model="title" type="text" /></label>
        <label class="filter-label">file_uri <input v-model="fileUri" type="text" /></label>
      </div>
      <textarea v-model="ingestText" class="wording-box" rows="8" />
      <div class="row-actions">
        <button class="btn" type="button" :disabled="busy" @click="ingest">入库条款</button>
        <span v-if="lastVersionId" class="tag ok">version {{ lastVersionId }} · {{ lastClauses.length }} 条</span>
        <span v-if="tablesUnlinked > 0" class="tag warn">tables_unlinked {{ tablesUnlinked }}</span>
      </div>
      <PdfTickPanel
        :busy="busy"
        :ingest-run-id="ingestRunId"
        :pages="tickPages"
        :tick-done="tickDone"
        @file-change="onPdfSelected"
        @tick="tickPage"
        @tick-all="tickAllPages"
      />
    </section>
    <section class="card">
      <h2 class="card-title">生效版本 / 图边</h2>
      <div class="row-actions">
        <label class="filter-label">
          version_id
          <input v-model="bindVersionId" type="text" />
        </label>
        <button class="btn ghost" type="button" :disabled="busy || !bindVersionId" @click="bindEffective">
          绑定生效版
        </button>
        <span v-if="pack?.effective_standard_version_id" class="tag">
          生效 {{ pack.effective_standard_version_id }}
        </span>
      </div>
      <div class="row-actions">
        <label class="filter-label">from <input v-model="edgeFrom" type="text" /></label>
        <label class="filter-label">to <input v-model="edgeTo" type="text" /></label>
        <label class="filter-label">
          边类型
          <select v-model="edgeKind">
            <option v-for="item in edgeDict" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <button class="btn ghost" type="button" :disabled="busy || !edgeFrom || !edgeTo" @click="addEdge">
          添加边
        </button>
      </div>
    </section>
    <section class="card">
      <h2 class="card-title">检索</h2>
      <div class="row-actions">
        <input v-model="query" type="text" class="grow" placeholder="问句或条款号，如：1.1 / 事假须提前申请" />
        <button class="btn" type="button" :disabled="busy" @click="search">检索</button>
      </div>
      <RetrieveHitsTable
        :hits="hits"
        :path-dict="pathDict"
        :dict-label="dictLabel"
        :selected-key="selectedHit && `${selectedHit.unit_id}-${selectedHit.retrieve_path}-${selectedHit.page_start}-${selectedHit.page_end}`"
        @select="selectedHit = $event"
      />
      <HitDetailPanel v-if="selectedHit" :hit="selectedHit" />
    </section>
  </div>
  <!-- Route packId is enough to mount: waiting on hits hid the sidebar on first paint and unmounted it at 0 hits. Never bind the first Job. -->
  <StepChat v-if="packId" :trace-id="traceId" :pack-id="packId" :hits="hits" step="retrieve" />
</template>
