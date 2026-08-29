<script setup lang="ts">
import type { DocTypeView } from "../../services/types";
import type { CrudTarget } from "./useProjectHome";

defineProps<{
  renameTarget: CrudTarget | null;
  renameInput: string;
  deleteTarget: CrudTarget | null;
  newDocTypePackId: string;
  newDocTypeName: string;
  newDocTypeParentId: string;
  fieldDefsTarget: DocTypeView | null;
  fieldDefsDraft: Array<{ field_key: string; value_type: string; required: number }>;
  docTypesByPack: Record<string, DocTypeView[]>;
  busy: boolean;
  crudLabel: (target: CrudTarget) => string;
}>();

const emit = defineEmits<{
  "update:renameInput": [value: string];
  "update:newDocTypeName": [value: string];
  "update:newDocTypeParentId": [value: string];
  submitRename: [];
  closeRename: [];
  submitDelete: [];
  closeDelete: [];
  submitNewDocType: [];
  closeNewDocType: [];
  addFieldDefRow: [];
  removeFieldDefRow: [index: number];
  saveFieldDefs: [];
  closeFieldDefs: [];
}>();
</script>

<template>
  <section v-if="renameTarget" class="card dialog-panel">
    <p>
      <strong>重命名{{ renameTarget.kind === "project" ? "项目" : "规范包" }}</strong>
    </p>
    <div class="row-actions">
      <label class="filter-label">
        新名称
        <input
          :value="renameInput"
          type="text"
          @input="emit('update:renameInput', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="emit('submitRename')"
        />
      </label>
      <button class="btn" type="button" :disabled="busy" @click="emit('submitRename')">保存</button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('closeRename')">取消</button>
    </div>
  </section>
  <section v-if="deleteTarget" class="card dialog-panel">
    <p>确定删除{{ deleteTarget.kind === "project" ? "项目" : "规范包" }}「{{ crudLabel(deleteTarget) }}」？</p>
    <div class="row-actions">
      <button class="btn danger" type="button" :disabled="busy" @click="emit('submitDelete')">确定删除</button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('closeDelete')">取消</button>
    </div>
  </section>
  <section v-if="newDocTypePackId" class="card dialog-panel">
    <p><strong>新建文档类型</strong></p>
    <div class="row-actions">
      <label class="filter-label">
        类型名称
        <input
          :value="newDocTypeName"
          type="text"
          @input="emit('update:newDocTypeName', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="emit('submitNewDocType')"
        />
      </label>
      <label class="filter-label">
        父类型（可选）
        <select
          :value="newDocTypeParentId"
          @change="emit('update:newDocTypeParentId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">无</option>
          <option
            v-for="dt in docTypesByPack[newDocTypePackId] ?? []"
            :key="dt.doc_type_id"
            :value="dt.doc_type_id"
          >
            {{ dt.name }}
          </option>
        </select>
      </label>
      <button class="btn" type="button" :disabled="busy" @click="emit('submitNewDocType')">创建</button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('closeNewDocType')">取消</button>
    </div>
  </section>
  <section v-if="fieldDefsTarget" class="card dialog-panel">
    <p>
      <strong>编辑基字段 — {{ fieldDefsTarget.name }}</strong>
      <span class="muted">（无坐标，由模板扩展框补充）</span>
    </p>
    <table>
      <thead>
        <tr>
          <th>field_key</th>
          <th>value_type</th>
          <th>required</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in fieldDefsDraft" :key="i">
          <td><input v-model="row.field_key" type="text" /></td>
          <td><input v-model="row.value_type" type="text" /></td>
          <td><input v-model.number="row.required" type="checkbox" :true-value="1" :false-value="0" /></td>
          <td>
            <button class="btn ghost" type="button" :disabled="busy" @click="emit('removeFieldDefRow', i)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="row-actions">
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('addFieldDefRow')">添加字段</button>
      <button class="btn" type="button" :disabled="busy" @click="emit('saveFieldDefs')">保存基字段</button>
      <button class="btn ghost" type="button" :disabled="busy" @click="emit('closeFieldDefs')">取消</button>
    </div>
  </section>
</template>

<style scoped>
.muted {
  color: var(--apt-muted, #6b7280);
  font-size: 13px;
  margin-left: 8px;
}
</style>
