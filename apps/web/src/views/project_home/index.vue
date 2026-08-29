<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StepChat from "../../components/StepChat.vue";
import { rememberDemoNav, resetDemo } from "../../services/demo-session";
import { errorMessage, http } from "../../services/http";
import type {
  DocTypeView,
  FieldDefView,
  ProjectView,
  SpecPackView,
  TemplateView,
} from "../../services/types";

const projects = ref<ProjectView[]>([]);
const packsByProject = ref<Record<string, SpecPackView[]>>({});
const docTypesByPack = ref<Record<string, DocTypeView[]>>({});
const expandedPacks = ref<Record<string, boolean>>({});
const selectedProjectId = ref("");
const projectName = ref("演示项目-夹具");
const packName = ref("空规范包");
const error = ref("");
const busy = ref(false);
const traceId = ref("");

type CrudTarget =
  | { kind: "project"; project: ProjectView }
  | { kind: "pack"; pack: SpecPackView };

const renameTarget = ref<CrudTarget | null>(null);
const renameInput = ref("");
const deleteTarget = ref<CrudTarget | null>(null);

interface DraftFieldDef {
  field_key: string;
  value_type: string;
  required: number;
}

const createDocTypePanel = ref<{ packId: string; name: string; parentDocTypeId: string } | null>(null);
const fieldDefsPanel = ref<{ packId: string; docTypeId: string; docTypeName: string; defs: DraftFieldDef[] } | null>(
  null,
);
const createTemplatePanel = ref<{ packId: string; docTypeId: string; name: string } | null>(null);

function crudLabel(target: CrudTarget): string {
  return target.kind === "project" ? target.project.name : target.pack.name;
}

/** Map ledger conflict codes to operator-facing Chinese. */
function friendlyCrudError(err: unknown): string {
  const msg = errorMessage(err);
  if (msg.includes("project has spec packs")) {
    return "无法删除：该项目下仍有规范包，请先删除所有规范包。";
  }
  if (msg.includes("spec pack has jobs")) {
    return "无法删除：该规范包仍有关联任务（演示夹具包无法直接删，可新建空包后删无任务包）。";
  }
  if (msg.includes("doc type has children")) {
    return "无法删除：该文档类型仍有子类型。";
  }
  if (msg.includes("doc type has templates")) {
    return "无法删除：该文档类型仍有关联模板。";
  }
  if (msg.includes("doc type has jobs")) {
    return "无法删除：该文档类型仍有关联任务。";
  }
  return msg;
}

function parentDocTypeName(packId: string, docType: DocTypeView): string {
  if (!docType.parent_doc_type_id) return "—";
  const types = docTypesByPack.value[packId] ?? [];
  return types.find((t) => t.doc_type_id === docType.parent_doc_type_id)?.name ?? "—";
}

function templateCount(pack: SpecPackView, docTypeId: string): number {
  return (pack.templates ?? []).filter((t) => t.doc_type_id === docTypeId).length;
}

function firstTemplateId(pack: SpecPackView, docTypeId: string): string | null {
  return (pack.templates ?? []).find((t) => t.doc_type_id === docTypeId)?.template_id ?? null;
}

async function loadDocTypes(packId: string) {
  const data = await http<{ docTypes: DocTypeView[] }>(`/api/packs/${packId}/doc-types`);
  docTypesByPack.value = { ...docTypesByPack.value, [packId]: data.docTypes };
}

async function togglePackExpand(packId: string) {
  const next = !expandedPacks.value[packId];
  expandedPacks.value = { ...expandedPacks.value, [packId]: next };
  if (next && !docTypesByPack.value[packId]) {
    try {
      await loadDocTypes(packId);
    } catch (err) {
      error.value = errorMessage(err);
    }
  }
}

async function load() {
  const data = await http<{ projects: ProjectView[] }>("/api/projects");
  projects.value = data.projects;
  const next: Record<string, SpecPackView[]> = {};
  for (const project of data.projects) {
    const packs = await http<{ packs: SpecPackView[] }>(`/api/projects/${project.project_id}/packs`);
    next[project.project_id] = packs.packs;
  }
  packsByProject.value = next;
  if (!selectedProjectId.value || !data.projects.some((p) => p.project_id === selectedProjectId.value)) {
    selectedProjectId.value = data.projects[0]?.project_id ?? "";
  }
  const firstPack = selectedProjectId.value ? next[selectedProjectId.value]?.[0] : undefined;
  const template = firstPack?.templates?.[0];
  rememberDemoNav({
    projectId: selectedProjectId.value,
    packId: firstPack?.pack_id ?? "",
    templateId: template?.template_id ?? "",
  });
  for (const packId of Object.keys(expandedPacks.value).filter((id) => expandedPacks.value[id])) {
    await loadDocTypes(packId);
  }
}

async function ensureSeed() {
  const jobs = await http<{ jobs: { job_id: string; trace_id: string }[] }>("/api/jobs");
  if (jobs.jobs.length === 0) {
    const reset = await resetDemo();
    traceId.value = reset.jobs[0]?.job.trace_id ?? "";
  } else {
    traceId.value = jobs.jobs[0]?.trace_id ?? "";
    rememberDemoNav({ jobId: jobs.jobs[0]?.job_id ?? "", traceId: traceId.value });
  }
  await load();
}

async function createProject() {
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ project: ProjectView }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: projectName.value.trim() || "演示项目-夹具" }),
    });
    selectedProjectId.value = result.project.project_id;
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function createPack() {
  if (!selectedProjectId.value) {
    error.value = "请先选择或新建项目";
    return;
  }
  const name = packName.value.trim() || "空规范包";
  if (/公路|水利|房建/.test(name)) {
    error.value = "规范包名称不得使用公路/水利/房建预置";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const packRes = await http<{ pack: SpecPackView }>("/api/packs", {
      method: "POST",
      body: JSON.stringify({
        projectId: selectedProjectId.value,
        name,
        version: "0",
      }),
    });
    const tpl = await http<{ template: TemplateView }>("/api/templates", {
      method: "POST",
      body: JSON.stringify({ packId: packRes.pack.pack_id, name: "空包模板" }),
    });
    rememberDemoNav({
      projectId: selectedProjectId.value,
      packId: packRes.pack.pack_id,
      templateId: tpl.template.template_id,
    });
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function annotateTo(pack: SpecPackView): string {
  const id = pack.templates?.[0]?.template_id;
  return id ? `/templates/${id}/annotate` : `/packs/${pack.pack_id}/rules`;
}

function openCreateDocType(packId: string) {
  createDocTypePanel.value = { packId, name: "", parentDocTypeId: "" };
  fieldDefsPanel.value = null;
  createTemplatePanel.value = null;
  error.value = "";
}

function closeCreateDocType() {
  createDocTypePanel.value = null;
}

async function submitCreateDocType() {
  const panel = createDocTypePanel.value;
  if (!panel) return;
  const name = panel.name.trim();
  if (!name) {
    error.value = "文档类型名称不能为空";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await http<{ docType: DocTypeView }>("/api/doc-types", {
      method: "POST",
      body: JSON.stringify({
        packId: panel.packId,
        name,
        parentDocTypeId: panel.parentDocTypeId || null,
      }),
    });
    closeCreateDocType();
    await loadDocTypes(panel.packId);
    await load();
  } catch (err) {
    error.value = friendlyCrudError(err);
  } finally {
    busy.value = false;
  }
}

async function openFieldDefs(packId: string, docType: DocTypeView) {
  busy.value = true;
  error.value = "";
  try {
    const data = await http<{ defs: FieldDefView[] }>(`/api/doc-types/${docType.doc_type_id}/field-defs`);
    fieldDefsPanel.value = {
      packId,
      docTypeId: docType.doc_type_id,
      docTypeName: docType.name,
      defs: data.defs.map((d) => ({
        field_key: d.field_key,
        value_type: d.value_type,
        required: d.required,
      })),
    };
    createDocTypePanel.value = null;
    createTemplatePanel.value = null;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function closeFieldDefs() {
  fieldDefsPanel.value = null;
}

function addFieldDefRow() {
  if (!fieldDefsPanel.value) return;
  fieldDefsPanel.value.defs.push({ field_key: "", value_type: "string", required: 0 });
}

function removeFieldDefRow(index: number) {
  if (!fieldDefsPanel.value) return;
  fieldDefsPanel.value.defs.splice(index, 1);
}

async function submitFieldDefs() {
  const panel = fieldDefsPanel.value;
  if (!panel) return;
  const defs = panel.defs
    .map((d) => ({
      field_key: d.field_key.trim(),
      value_type: d.value_type.trim() || "string",
      required: d.required ? 1 : 0,
    }))
    .filter((d) => d.field_key.length > 0);
  busy.value = true;
  error.value = "";
  try {
    await http<{ defs: FieldDefView[] }>(`/api/doc-types/${panel.docTypeId}/field-defs`, {
      method: "PUT",
      body: JSON.stringify({ defs }),
    });
    closeFieldDefs();
  } catch (err) {
    error.value = friendlyCrudError(err);
  } finally {
    busy.value = false;
  }
}

function openCreateTemplate(packId: string, docTypeId: string) {
  createTemplatePanel.value = { packId, docTypeId, name: "" };
  createDocTypePanel.value = null;
  fieldDefsPanel.value = null;
  error.value = "";
}

function closeCreateTemplate() {
  createTemplatePanel.value = null;
}

async function submitCreateTemplate() {
  const panel = createTemplatePanel.value;
  if (!panel) return;
  const name = panel.name.trim() || "新模板";
  busy.value = true;
  error.value = "";
  try {
    const result = await http<{ template: TemplateView }>("/api/templates", {
      method: "POST",
      body: JSON.stringify({
        packId: panel.packId,
        docTypeId: panel.docTypeId,
        name,
      }),
    });
    rememberDemoNav({ packId: panel.packId, templateId: result.template.template_id });
    closeCreateTemplate();
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

function openRenameProject(project: ProjectView) {
  renameTarget.value = { kind: "project", project };
  renameInput.value = project.name;
  deleteTarget.value = null;
  error.value = "";
}

function openRenamePack(pack: SpecPackView) {
  renameTarget.value = { kind: "pack", pack };
  renameInput.value = pack.name;
  deleteTarget.value = null;
  error.value = "";
}

function closeRename() {
  renameTarget.value = null;
  renameInput.value = "";
}

async function submitRename() {
  const target = renameTarget.value;
  if (!target) return;
  const name = renameInput.value.trim();
  if (!name) {
    error.value = "名称不能为空";
    return;
  }
  if (name === crudLabel(target)) {
    closeRename();
    return;
  }
  if (target.kind === "pack" && /公路|水利|房建/.test(name)) {
    error.value = "规范包名称不得使用公路/水利/房建预置";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    if (target.kind === "project") {
      await http(`/api/projects/${target.project.project_id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
    } else {
      await http(`/api/packs/${target.pack.pack_id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
    }
    closeRename();
    await load();
  } catch (err) {
    error.value = friendlyCrudError(err);
  } finally {
    busy.value = false;
  }
}

function openDeleteProject(project: ProjectView) {
  deleteTarget.value = { kind: "project", project };
  renameTarget.value = null;
  error.value = "";
}

function openDeletePack(pack: SpecPackView) {
  deleteTarget.value = { kind: "pack", pack };
  renameTarget.value = null;
  error.value = "";
}

function closeDelete() {
  deleteTarget.value = null;
}

async function submitDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  busy.value = true;
  error.value = "";
  try {
    if (target.kind === "project") {
      await http(`/api/projects/${target.project.project_id}`, { method: "DELETE" });
      if (selectedProjectId.value === target.project.project_id) {
        selectedProjectId.value = "";
      }
    } else {
      await http(`/api/packs/${target.pack.pack_id}`, { method: "DELETE" });
    }
    closeDelete();
    await load();
  } catch (err) {
    error.value = friendlyCrudError(err);
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
    <h1>项目与规范包</h1>
    <p class="sub">空规范包，无预置公路/水利/房建字样。规范包由用户自行配置。验收 A1。</p>
    <div class="row-actions">
      <label class="filter-label">
        项目名
        <input v-model="projectName" type="text" />
      </label>
      <button class="btn" type="button" :disabled="busy" @click="createProject">新建项目</button>
      <label class="filter-label">
        归属项目
        <select v-model="selectedProjectId">
          <option v-for="project in projects" :key="project.project_id" :value="project.project_id">
            {{ project.name }}
          </option>
        </select>
      </label>
      <label class="filter-label">
        规范包名
        <input v-model="packName" type="text" />
      </label>
      <button class="btn ghost" type="button" :disabled="busy || !selectedProjectId" @click="createPack">
        新建空规范包
      </button>
    </div>
    <p v-if="error" class="sub error-text">{{ error }}</p>
    <section v-if="renameTarget" class="card dialog-panel">
      <p>
        <strong>重命名{{ renameTarget.kind === "project" ? "项目" : "规范包" }}</strong>
      </p>
      <div class="row-actions">
        <label class="filter-label">
          新名称
          <input v-model="renameInput" type="text" @keydown.enter.prevent="submitRename" />
        </label>
        <button class="btn" type="button" :disabled="busy" @click="submitRename">保存</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeRename">取消</button>
      </div>
    </section>
    <section v-if="deleteTarget" class="card dialog-panel">
      <p>
        确定删除{{ deleteTarget.kind === "project" ? "项目" : "规范包" }}「{{ crudLabel(deleteTarget) }}」？
      </p>
      <div class="row-actions">
        <button class="btn danger" type="button" :disabled="busy" @click="submitDelete">确定删除</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeDelete">取消</button>
      </div>
    </section>
    <section v-if="createDocTypePanel" class="card dialog-panel">
      <p><strong>新建文档类型</strong></p>
      <div class="row-actions">
        <label class="filter-label">
          名称
          <input v-model="createDocTypePanel.name" type="text" @keydown.enter.prevent="submitCreateDocType" />
        </label>
        <label class="filter-label">
          父类型
          <select v-model="createDocTypePanel.parentDocTypeId">
            <option value="">无（根类型）</option>
            <option
              v-for="dt in docTypesByPack[createDocTypePanel.packId] ?? []"
              :key="dt.doc_type_id"
              :value="dt.doc_type_id"
            >
              {{ dt.name }}
            </option>
          </select>
        </label>
        <button class="btn" type="button" :disabled="busy" @click="submitCreateDocType">创建</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeCreateDocType">取消</button>
      </div>
    </section>
    <section v-if="fieldDefsPanel" class="card dialog-panel">
      <p>
        <strong>编辑基字段 — {{ fieldDefsPanel.docTypeName }}</strong>
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
          <tr v-for="(def, i) in fieldDefsPanel.defs" :key="i">
            <td><input v-model="def.field_key" type="text" /></td>
            <td><input v-model="def.value_type" type="text" /></td>
            <td><input v-model.number="def.required" type="checkbox" :true-value="1" :false-value="0" /></td>
            <td>
              <button class="btn ghost" type="button" :disabled="busy" @click="removeFieldDefRow(i)">删除</button>
            </td>
          </tr>
          <tr v-if="fieldDefsPanel.defs.length === 0">
            <td colspan="4" class="muted">尚无基字段。可添加编号、日期A 等类型级字段。</td>
          </tr>
        </tbody>
      </table>
      <div class="row-actions">
        <button class="btn ghost" type="button" :disabled="busy" @click="addFieldDefRow">添加字段</button>
        <button class="btn" type="button" :disabled="busy" @click="submitFieldDefs">保存基字段</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeFieldDefs">取消</button>
      </div>
    </section>
    <section v-if="createTemplatePanel" class="card dialog-panel">
      <p><strong>新建模板</strong></p>
      <div class="row-actions">
        <label class="filter-label">
          模板名
          <input v-model="createTemplatePanel.name" type="text" placeholder="新模板" @keydown.enter.prevent="submitCreateTemplate" />
        </label>
        <button class="btn" type="button" :disabled="busy" @click="submitCreateTemplate">创建</button>
        <button class="btn ghost" type="button" :disabled="busy" @click="closeCreateTemplate">取消</button>
      </div>
    </section>
    <section class="card">
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th>规范包</th>
            <th>版本</th>
            <th>模板</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="project in projects" :key="project.project_id">
            <template v-for="pack in packsByProject[project.project_id] ?? []" :key="pack.pack_id">
              <tr>
                <td>{{ project.name }}</td>
                <td>
                  <button
                    class="btn ghost expand-btn"
                    type="button"
                    :aria-expanded="!!expandedPacks[pack.pack_id]"
                    @click="togglePackExpand(pack.pack_id)"
                  >
                    {{ expandedPacks[pack.pack_id] ? "▼" : "▶" }}
                  </button>
                  {{ pack.name }}
                </td>
                <td>{{ pack.version }}</td>
                <td>{{ pack.templates?.[0]?.name ?? "—" }}</td>
                <td>
                  <RouterLink :to="annotateTo(pack)">标注模板</RouterLink>
                  ·
                  <RouterLink :to="`/packs/${pack.pack_id}/rules`">规则</RouterLink>
                  ·
                  <RouterLink :to="`/packs/${pack.pack_id}/standards`">标准库</RouterLink>
                  ·
                  <button class="btn ghost" type="button" :disabled="busy" @click="openRenamePack(pack)">重命名</button>
                  ·
                  <button class="btn ghost" type="button" :disabled="busy" @click="openDeletePack(pack)">删除</button>
                </td>
              </tr>
              <tr v-if="expandedPacks[pack.pack_id]" class="detail-row">
                <td colspan="5">
                  <div class="nested-section">
                    <div class="row-actions">
                      <strong>文档类型</strong>
                      <button class="btn ghost" type="button" :disabled="busy" @click="openCreateDocType(pack.pack_id)">
                        新建文档类型
                      </button>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th>父类型</th>
                          <th>模板数</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="dt in docTypesByPack[pack.pack_id] ?? []" :key="dt.doc_type_id">
                          <td>{{ dt.name }}</td>
                          <td>{{ parentDocTypeName(pack.pack_id, dt) }}</td>
                          <td>{{ templateCount(pack, dt.doc_type_id) }}</td>
                          <td>
                            <button class="btn ghost" type="button" :disabled="busy" @click="openFieldDefs(pack.pack_id, dt)">
                              编辑基字段
                            </button>
                            ·
                            <button
                              class="btn ghost"
                              type="button"
                              :disabled="busy"
                              @click="openCreateTemplate(pack.pack_id, dt.doc_type_id)"
                            >
                              新建模板
                            </button>
                            ·
                            <RouterLink
                              v-if="firstTemplateId(pack, dt.doc_type_id)"
                              :to="`/templates/${firstTemplateId(pack, dt.doc_type_id)}/annotate`"
                            >
                              标注
                            </RouterLink>
                            <span v-else class="muted">标注（需先建模板）</span>
                          </td>
                        </tr>
                        <tr v-if="(docTypesByPack[pack.pack_id] ?? []).length === 0">
                          <td colspan="4" class="muted">尚无文档类型。可新建类型并配置基字段。</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="(packsByProject[project.project_id] ?? []).length === 0">
              <td>{{ project.name }}</td>
              <td colspan="3">尚无规范包。可新建空规范包。</td>
              <td>
                <button class="btn ghost" type="button" :disabled="busy" @click="openRenameProject(project)">重命名</button>
                ·
                <button class="btn ghost" type="button" :disabled="busy" @click="openDeleteProject(project)">删除</button>
              </td>
            </tr>
          </template>
          <tr v-if="projects.length === 0">
            <td colspan="5">暂无项目。可新建项目，或从任务页重置演示。</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
  <StepChat :trace-id="traceId" step="configure" />
</template>

<style scoped>
.expand-btn {
  padding: 2px 8px;
  margin-right: 6px;
  min-width: 32px;
}
.detail-row td {
  background: var(--apt-surface);
  padding-top: 0;
}
.nested-section {
  padding: 8px 0 4px;
}
.nested-section table {
  margin-top: 8px;
}
</style>
