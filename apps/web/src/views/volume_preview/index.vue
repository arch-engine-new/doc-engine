<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { demoNav, ensureDemoSession, rememberDemoNav } from "../../services/demo-session";
import { errorMessage, HttpError, http } from "../../services/http";
import {
  prettyJson,
  type JobView,
  type SpecPackView,
  type VolumePreviewNode,
  type VolumePreviewTree,
} from "../../services/types";

const route = useRoute();
const router = useRouter();

const job = ref<JobView | null>(null);
const pack = ref<SpecPackView | null>(null);
const tree = ref<VolumePreviewTree | null>(null);
const groupKeysText = ref("zone,process");
const orderKey = ref("seq");
const error = ref("");
const busy = ref(false);

const jobId = computed(() => String(route.params.id ?? ""));
const submitted = computed(() => false);

function formatTree(nodes: VolumePreviewNode[] | unknown, indent = ""): string[] {
  if (!Array.isArray(nodes)) return [];
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1;
    const branch = last ? "└─ " : "├─ ";
    const nextIndent = indent + (last ? "    " : "│   ");
    if (node.kind === "group") {
      lines.push(`${indent}${branch}${node.key}=${node.value || "(空)"}`);
      lines.push(...formatTree(node.children, nextIndent));
    } else {
      lines.push(`${indent}${branch}${node.extractionId} ${prettyJson(node.fields)}`);
    }
  });
  return lines;
}

const treeText = computed(() => {
  if (!tree.value) return "尚无预览树。";
  const header = [
    `submitted=${String(tree.value.submitted)}`,
    `groupKeys=${JSON.stringify(tree.value.groupKeys)}`,
    `orderKey=${tree.value.orderKey ?? "null"}`,
  ].join("\n");
  return `${header}\n${formatTree(tree.value.nodes).join("\n")}`;
});

async function loadJob(): Promise<JobView | null> {
  const listed = await http<{ jobs: JobView[] }>("/api/jobs");
  return listed.jobs.find((row) => row.job_id === jobId.value) ?? null;
}

async function load() {
  error.value = "";
  try {
    job.value = await loadJob();
    if (!job.value) {
      throw new HttpError(404, { error: `job not found: ${jobId.value}` });
    }
    rememberDemoNav({ jobId: job.value.job_id, traceId: job.value.trace_id, packId: job.value.pack_id ?? demoNav.packId });
    if (job.value.pack_id) {
      const packRes = await http<{ pack: SpecPackView }>(`/api/packs/${job.value.pack_id}`);
      pack.value = packRes.pack;
      try {
        const keys = packRes.pack.group_keys_json ? (JSON.parse(packRes.pack.group_keys_json) as unknown) : [];
        groupKeysText.value = Array.isArray(keys) ? keys.join(",") : "zone,process";
      } catch {
        groupKeysText.value = "zone,process";
      }
      orderKey.value = packRes.pack.order_key ?? "";
    }
    let volumeRes: { tree: VolumePreviewTree };
    try {
      volumeRes = await http<{ tree: VolumePreviewTree }>(`/api/jobs/${jobId.value}/volume`);
      if (!Array.isArray(volumeRes.tree?.nodes)) {
        volumeRes = await http<{ tree: VolumePreviewTree }>(`/api/jobs/${jobId.value}/volume`, { method: "POST" });
      }
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 404) throw err;
      volumeRes = await http<{ tree: VolumePreviewTree }>(`/api/jobs/${jobId.value}/volume`, { method: "POST" });
    }
    tree.value = { ...volumeRes.tree, submitted: false };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      const ids = await ensureDemoSession();
      if (ids.jobId && ids.jobId !== jobId.value) {
        await router.replace(`/jobs/${ids.jobId}/volume`);
        return;
      }
    }
    error.value = errorMessage(err);
  }
}

async function saveGroupKeys() {
  if (!job.value?.pack_id) return;
  busy.value = true;
  error.value = "";
  try {
    const keys = groupKeysText.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await http(`/api/packs/${job.value.pack_id}/group-keys`, {
      method: "POST",
      body: JSON.stringify({ groupKeys: keys, orderKey: orderKey.value || null }),
    });
    const volumeRes = await http<{ tree: VolumePreviewTree }>(`/api/jobs/${jobId.value}/volume`, { method: "POST" });
    tree.value = { ...volumeRes.tree, submitted: false };
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
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
    <h1>组卷预览</h1>
    <p class="sub">
      按用户配置的 groupKeys 分组。tree.submitted 恒为 false。提交按钮禁用，无成功提示。对话不能 submit。验收 A7。
    </p>
    <div class="row-actions">
      <span class="tag">submitted={{ submitted }}</span>
      <RouterLink v-if="job" :to="`/audit/${job.trace_id}`">trace {{ job.trace_id }}</RouterLink>
    </div>
    <div class="row-actions">
      <label class="filter-label">
        groupKeys
        <input v-model="groupKeysText" type="text" />
      </label>
      <label class="filter-label">
        orderKey
        <input v-model="orderKey" type="text" />
      </label>
      <button class="btn ghost" type="button" :disabled="busy || !job?.pack_id" @click="saveGroupKeys">
        写入分组并重预览
      </button>
      <button class="btn ghost" type="button" disabled title="不对 agent-runtime 开放">
        提交组卷（工作台专用，已禁用）
      </button>
    </div>
    <p v-if="error" class="sub">{{ error }}</p>
    <section class="card tree">
      <pre class="extract">{{ treeText }}</pre>
    </section>
  </div>
  <StepChat :trace-id="job?.trace_id" step="previewed" />
</template>
