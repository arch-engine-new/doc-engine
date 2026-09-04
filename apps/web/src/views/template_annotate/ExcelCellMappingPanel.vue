<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  errorMessage,
  fetchExcelMappings,
  saveExcelMappings,
  uploadExcelTemplate,
} from "../../services/http";
import type {
  EffectiveFieldBoxView,
  ExcelCellMappingWrite,
  TemplateView,
} from "../../services/types";

interface ExcelCellMappingPanelProps {
  templateId: string;
  template: TemplateView;
  inheritedFields: EffectiveFieldBoxView[];
}

const props = defineProps<ExcelCellMappingPanelProps>();

const emit = defineEmits<{
  "template-updated": [template: TemplateView];
}>();

const mappings = ref<ExcelCellMappingWrite[]>([]);
const nextCell = ref("");
const nextFieldKey = ref("");
const uploadSheetName = ref("");
const error = ref("");
const busy = ref(false);
const saved = ref(false);
const uploading = ref(false);

const sheetName = computed(() => props.template.excel_sheet_name ?? "—");

const fieldOptions = computed(() =>
  props.inheritedFields.map((field) => ({
    field_key: field.field_key,
    value_type: field.value_type,
  })),
);

function toDraft(
  row: ExcelCellMappingWrite & { mapping_id?: string },
): ExcelCellMappingWrite {
  return {
    sheet_name: row.sheet_name,
    cell: row.cell,
    field_key: row.field_key,
    value_type: row.value_type,
    signature_role: row.signature_role,
  };
}

async function loadMappings() {
  error.value = "";
  saved.value = false;
  try {
    const rows = await fetchExcelMappings(props.templateId);
    mappings.value = rows.map(toDraft);
  } catch (err) {
    error.value = errorMessage(err);
  }
}

function defaultSheetName(): string {
  return props.template.excel_sheet_name ?? uploadSheetName.value.trim() ?? "";
}

function addMapping() {
  const cell = nextCell.value.trim().toUpperCase();
  const fieldKey = nextFieldKey.value.trim();
  if (!cell || !fieldKey) {
    error.value = "请填写单元格地址并选择 field_key。";
    return;
  }
  const field = fieldOptions.value.find((f) => f.field_key === fieldKey);
  mappings.value.push({
    sheet_name: defaultSheetName(),
    cell,
    field_key: fieldKey,
    value_type: field?.value_type ?? "string",
    signature_role: null,
  });
  nextCell.value = "";
  saved.value = false;
  error.value = "";
}

function removeMapping(index: number) {
  mappings.value.splice(index, 1);
  saved.value = false;
}

async function save() {
  busy.value = true;
  error.value = "";
  try {
    const rows = await saveExcelMappings(props.templateId, mappings.value);
    mappings.value = rows.map(toDraft);
    saved.value = true;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  uploading.value = true;
  error.value = "";
  try {
    const sheet = uploadSheetName.value.trim() || props.template.excel_sheet_name || undefined;
    const result = await uploadExcelTemplate(props.templateId, file, sheet);
    emit("template-updated", result.template);
    uploadSheetName.value = result.template.excel_sheet_name ?? "";
    await loadMappings();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    uploading.value = false;
  }
}

watch(
  () => props.templateId,
  () => {
    uploadSheetName.value = props.template.excel_sheet_name ?? "";
    void loadMappings();
  },
  { immediate: true },
);

watch(
  () => props.template.excel_sheet_name,
  (name) => {
    if (name) uploadSheetName.value = name;
  },
);
</script>

<template>
  <div class="excel-panel">
    <div class="excel-meta card">
      <p>
        <strong>工作表：</strong>{{ sheetName }}
        <span v-if="template.excel_template_uri" class="muted">
          · 模板已上传
          <a :href="template.excel_template_uri" target="_blank" rel="noopener">下载</a>
        </span>
        <span v-else class="muted">· 尚未上传 Excel 模板</span>
      </p>
      <div class="row-actions">
        <label class="filter-label">
          上传 .xlsx
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="uploading || busy" @change="onFileChange" />
        </label>
        <label class="filter-label">
          sheet 名（可选）
          <input v-model="uploadSheetName" type="text" placeholder="默认使用模板已配置 sheet" />
        </label>
        <span v-if="uploading" class="tag">上传中…</span>
      </div>
    </div>

    <div class="row-actions">
      <label class="filter-label">
        cell
        <input v-model="nextCell" type="text" placeholder="如 B4" />
      </label>
      <label class="filter-label">
        field_key
        <select v-model="nextFieldKey">
          <option value="">选择继承字段</option>
          <option v-for="field in fieldOptions" :key="field.field_key" :value="field.field_key">
            {{ field.field_key }} ({{ field.value_type }})
          </option>
        </select>
      </label>
      <button class="btn ghost" type="button" :disabled="busy" @click="addMapping">添加映射</button>
      <button class="btn" type="button" :disabled="busy" @click="save">保存映射</button>
      <span v-if="saved" class="tag ok">已保存 {{ mappings.length }} 条映射</span>
    </div>

    <p v-if="error" class="sub error-text">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>cell</th>
          <th>field_key</th>
          <th>value_type</th>
          <th>signature_role</th>
          <th>sheet</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in mappings" :key="`${row.cell}-${row.field_key}-${i}`">
          <td><input v-model="row.cell" type="text" @input="saved = false" /></td>
          <td>
            <select v-model="row.field_key" @change="saved = false">
              <option v-for="field in fieldOptions" :key="field.field_key" :value="field.field_key">
                {{ field.field_key }}
              </option>
            </select>
          </td>
          <td><input v-model="row.value_type" type="text" @input="saved = false" /></td>
          <td>
            <input
              :value="row.signature_role ?? ''"
              type="text"
              placeholder="可选"
              @input="row.signature_role = ($event.target as HTMLInputElement).value || null; saved = false"
            />
          </td>
          <td><input v-model="row.sheet_name" type="text" @input="saved = false" /></td>
          <td>
            <button class="btn ghost" type="button" :disabled="busy" @click="removeMapping(i)">删除</button>
          </td>
        </tr>
        <tr v-if="mappings.length === 0">
          <td colspan="6" class="muted">暂无单元格映射。上传模板后添加 cell → field_key 绑定并保存。</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.excel-panel {
  min-width: 0;
}
.excel-meta {
  margin-bottom: 12px;
}
.muted {
  color: var(--apt-text-muted);
  font-size: 13px;
}
</style>
