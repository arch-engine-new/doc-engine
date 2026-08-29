<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import InheritedFieldsPanel from "./InheritedFieldsPanel.vue";
import ExcelCellMappingPanel from "./ExcelCellMappingPanel.vue";
import { boxStyle, useAnnotateCanvas, type DraftBox } from "./useAnnotateCanvas";
import { demoNav, ensureDemoSession, rememberDemoNav } from "../../services/demo-session";
import { errorMessage, HttpError, http } from "../../services/http";
import type {
  DocTypeView,
  EffectiveFieldBoxView,
  FieldBoxView,
  TemplateView,
} from "../../services/types";

const route = useRoute();
const router = useRouter();

const template = ref<TemplateView | null>(null);
const docTypePath = ref<string[]>([]);
const inheritedFields = ref<EffectiveFieldBoxView[]>([]);
const boxes = ref<DraftBox[]>([]);
const nextKey = ref("编号");
const nextType = ref("string");
const error = ref("");
const busy = ref(false);
const saved = ref(false);
const traceId = ref("");

const { ghost, onDown, onMove, onUp, removeBox } = useAnnotateCanvas(boxes, nextKey, nextType, () => {
  saved.value = false;
});

const templateId = computed(() => String(route.params.id ?? ""));

const isExcelMode = computed(() => template.value?.layout_kind === "excel");

const canvasStyle = computed(() => {
  const uri = template.value?.page_image_uri;
  if (uri) {
    return { backgroundImage: `url(${uri})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" };
  }
  return {};
});

const breadcrumb = computed(() => (docTypePath.value.length > 0 ? docTypePath.value.join(" / ") : "—"));

function toDraft(row: FieldBoxView): DraftBox {
  return {
    field_key: row.field_key,
    value_type: row.value_type,
    page: row.page,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
  };
}

async function loadDocTypePath(packId: string, docTypeId: string) {
  const listed = await http<{ docTypes: DocTypeView[] }>(`/api/packs/${packId}/doc-types`);
  const byId = new Map(listed.docTypes.map((dt) => [dt.doc_type_id, dt]));
  const path: string[] = [];
  let current = byId.get(docTypeId);
  while (current) {
    path.unshift(current.name);
    current = current.parent_doc_type_id ? byId.get(current.parent_doc_type_id) : undefined;
  }
  docTypePath.value = path;
}

async function load() {
  error.value = "";
  saved.value = false;
  const id = templateId.value;
  try {
    const [tpl, boxRes, effectiveRes, jobs] = await Promise.all([
      http<{ template: TemplateView }>(`/api/templates/${id}`),
      http<{ boxes: FieldBoxView[] }>(`/api/templates/${id}/boxes`),
      http<{ boxes: EffectiveFieldBoxView[] }>(`/api/templates/${id}/effective-boxes`),
      http<{ jobs: { trace_id: string }[] }>("/api/jobs"),
    ]);
    template.value = tpl.template;
    boxes.value = boxRes.boxes.map(toDraft);
    inheritedFields.value = effectiveRes.boxes.filter((b) => b.inherited);
    traceId.value = jobs.jobs[0]?.trace_id ?? demoNav.traceId;
    rememberDemoNav({ templateId: tpl.template.template_id, packId: tpl.template.pack_id, traceId: traceId.value });
    if (tpl.template.doc_type_id) {
      await loadDocTypePath(tpl.template.pack_id, tpl.template.doc_type_id);
    } else {
      docTypePath.value = [];
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      const ids = await ensureDemoSession();
      if (ids.templateId && ids.templateId !== id) {
        await router.replace(`/templates/${ids.templateId}/annotate`);
        return;
      }
    }
    error.value = errorMessage(err);
  }
}

async function saveBoxes() {
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ boxes: FieldBoxView[] }>(`/api/templates/${templateId.value}/boxes`, {
      method: "PUT",
      body: JSON.stringify({ boxes: boxes.value }),
    });
    boxes.value = result.boxes.map(toDraft);
    saved.value = true;
    const effectiveRes = await http<{ boxes: EffectiveFieldBoxView[] }>(
      `/api/templates/${templateId.value}/effective-boxes`,
    );
    inheritedFields.value = effectiveRes.boxes.filter((b) => b.inherited);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void load();
});

watch(templateId, () => {
  void load();
});
</script>

<template>
  <div class="wrap">
    <h1>模板标注</h1>
    <p class="sub">
      <template v-if="isExcelMode">
        左侧为类型继承的基字段（只读）；右侧配置 Excel 单元格与 field_key 映射。
      </template>
      <template v-else>
        左侧为类型继承的基字段（只读）；画布仅编辑扩展/覆盖框。保存 page / x / y / w / h / field_key / value_type。
      </template>
    </p>
    <p v-if="template" class="sub">
      模板 {{ template.name }} · 文档类型路径：{{ breadcrumb }}
    </p>
    <div v-if="!isExcelMode" class="row-actions">
      <label class="filter-label">
        field_key
        <input v-model="nextKey" type="text" />
      </label>
      <label class="filter-label">
        value_type
        <input v-model="nextType" type="text" />
      </label>
      <button class="btn" type="button" :disabled="busy" @click="saveBoxes">保存扩展框</button>
      <span v-if="saved" class="tag ok">已保存 {{ boxes.length }} 个扩展框</span>
    </div>
    <p v-if="error" class="sub error-text">{{ error }}</p>
    <section class="annotate-layout card">
      <InheritedFieldsPanel :inherited-fields="inheritedFields" />
      <ExcelCellMappingPanel
        v-if="isExcelMode && template"
        :template-id="templateId"
        :template="template"
        :inherited-fields="inheritedFields"
        @template-updated="onTemplateUpdated"
      />
      <div v-else class="annotate-main">
        <div
          class="canvas"
          :class="{ 'has-image': !!template?.page_image_uri }"
          :style="canvasStyle"
          @mousedown.prevent="onDown"
          @mousemove="onMove"
          @mouseup="onUp"
          @mouseleave="onUp"
        >
          <div
            v-for="field in inheritedFields.filter((f) => Number(f.w) > 0 && Number(f.h) > 0)"
            :key="`inherited-${field.field_key}`"
            class="box inherited"
            :style="boxStyle(field)"
          >
            {{ field.field_key }}
          </div>
          <div v-for="(box, i) in boxes" :key="`${box.field_key}-${i}`" class="box" :style="boxStyle(box)">
            {{ box.field_key }}
          </div>
          <div v-if="ghost" class="box" :style="boxStyle(ghost)" />
        </div>
        <table>
          <thead>
            <tr>
              <th>field_key</th>
              <th>value_type</th>
              <th>page</th>
              <th>x</th>
              <th>y</th>
              <th>w</th>
              <th>h</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(box, i) in boxes" :key="i">
              <td><input v-model="box.field_key" type="text" /></td>
              <td><input v-model="box.value_type" type="text" /></td>
              <td>{{ box.page }}</td>
              <td>{{ box.x }}</td>
              <td>{{ box.y }}</td>
              <td>{{ box.w }}</td>
              <td>{{ box.h }}</td>
              <td>
                <button class="btn ghost" type="button" :disabled="busy" @click="removeBox(i)">删除</button>
              </td>
            </tr>
            <tr v-if="boxes.length === 0">
              <td colspan="8">拖拽画框添加扩展字段。继承基字段在左侧只读展示。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <StepChat :trace-id="traceId" step="annotate" />
</template>

<style scoped>
.annotate-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: start;
}
.annotate-main {
  min-width: 0;
}
.canvas.has-image {
  background-color: var(--apt-surface);
}
.box.inherited {
  border-color: var(--apt-text-muted);
  background: rgba(120, 120, 120, 0.15);
  color: var(--apt-text-muted);
  pointer-events: none;
}
@media (max-width: 720px) {
  .annotate-layout {
    grid-template-columns: 1fr;
  }
}
</style>
