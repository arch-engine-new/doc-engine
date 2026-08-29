<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { DocTypeView, DocumentArtifactView, ProjectView, SpecPackView } from "../../services/types";

defineProps<{
  projects: ProjectView[];
  packsByProject: Record<string, SpecPackView[]>;
  docTypesByPack: Record<string, DocTypeView[]>;
  expandedPackId: string;
  busy: boolean;
  annotateTo: (pack: SpecPackView) => string;
  annotateDocType: (pack: SpecPackView, docType: DocTypeView) => string;
  hasExcelTemplate: (pack: SpecPackView, docType: DocTypeView) => boolean;
  artifactForDocType: (docTypeId: string) => DocumentArtifactView | undefined;
  artifactStatusLabel: (status: string) => string;
  isGeneratingDocType: (docTypeId: string) => boolean;
}>();

const emit = defineEmits<{
  togglePackDocTypes: [packId: string];
  openFieldDefs: [docType: DocTypeView];
  createTemplateForDocType: [pack: SpecPackView, docType: DocTypeView];
  openNewDocType: [packId: string];
  openRenamePack: [pack: SpecPackView];
  openDeletePack: [pack: SpecPackView];
  openRenameProject: [project: ProjectView];
  openDeleteProject: [project: ProjectView];
  generateInspectionBatch: [project: ProjectView, pack: SpecPackView, docType: DocTypeView];
}>();
</script>

<template>
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
              <td>{{ pack.name }}</td>
              <td>{{ pack.version }}</td>
              <td>{{ pack.templates?.[0]?.name ?? "—" }}</td>
              <td>
                <RouterLink :to="annotateTo(pack)">标注模板</RouterLink>
                ·
                <RouterLink :to="`/packs/${pack.pack_id}/rules`">规则</RouterLink>
                ·
                <RouterLink :to="`/packs/${pack.pack_id}/standards`">标准库</RouterLink>
                ·
                <button class="btn ghost" type="button" :disabled="busy" @click="emit('togglePackDocTypes', pack.pack_id)">
                  {{ expandedPackId === pack.pack_id ? "收起类型" : "文档类型" }}
                </button>
                ·
                <button class="btn ghost" type="button" :disabled="busy" @click="emit('openRenamePack', pack)">重命名</button>
                ·
                <button class="btn ghost" type="button" :disabled="busy" @click="emit('openDeletePack', pack)">删除</button>
              </td>
            </tr>
            <tr v-if="expandedPackId === pack.pack_id">
              <td colspan="5" class="nested-cell">
                <table class="nested-table">
                  <thead>
                    <tr>
                      <th>文档类型</th>
                      <th>父类型</th>
                      <th>模板数</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="dt in docTypesByPack[pack.pack_id] ?? []" :key="dt.doc_type_id">
                      <td>{{ dt.name }}</td>
                      <td>{{ dt.parent_name ?? "—" }}</td>
                      <td>{{ dt.template_count ?? 0 }}</td>
                      <td>
                        <button class="btn ghost" type="button" :disabled="busy" @click="emit('openFieldDefs', dt)">
                          编辑基字段
                        </button>
                        ·
                        <button
                          class="btn ghost"
                          type="button"
                          :disabled="busy"
                          @click="emit('createTemplateForDocType', pack, dt)"
                        >
                          新建模板
                        </button>
                        ·
                        <RouterLink :to="annotateDocType(pack, dt)">标注</RouterLink>
                        <template v-if="hasExcelTemplate(pack, dt)">
                          ·
                          <button
                            class="btn ghost"
                            type="button"
                            :disabled="busy || isGeneratingDocType(dt.doc_type_id)"
                            @click="emit('generateInspectionBatch', project, pack, dt)"
                          >
                            {{ isGeneratingDocType(dt.doc_type_id) ? "生成中…" : "生成检验批" }}
                          </button>
                          <template v-if="artifactForDocType(dt.doc_type_id)">
                            ·
                            <span class="artifact-status">
                              {{ artifactStatusLabel(artifactForDocType(dt.doc_type_id)!.status) }}
                            </span>
                            ·
                            <RouterLink :to="`/audit/${artifactForDocType(dt.doc_type_id)!.trace_id}`">
                              审计
                            </RouterLink>
                          </template>
                        </template>
                      </td>
                    </tr>
                    <tr v-if="(docTypesByPack[pack.pack_id] ?? []).length === 0">
                      <td colspan="4">尚无文档类型。</td>
                    </tr>
                  </tbody>
                </table>
                <button class="btn ghost" type="button" :disabled="busy" @click="emit('openNewDocType', pack.pack_id)">
                  新建文档类型
                </button>
              </td>
            </tr>
          </template>
          <tr v-if="(packsByProject[project.project_id] ?? []).length === 0">
            <td>{{ project.name }}</td>
            <td colspan="3">尚无规范包。可新建空规范包。</td>
            <td>
              <button class="btn ghost" type="button" :disabled="busy" @click="emit('openRenameProject', project)">重命名</button>
              ·
              <button class="btn ghost" type="button" :disabled="busy" @click="emit('openDeleteProject', project)">删除</button>
            </td>
          </tr>
        </template>
        <tr v-if="projects.length === 0">
          <td colspan="5">暂无项目。可新建项目，或从任务页重置演示。</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.nested-cell {
  background: var(--apt-surface-muted, #f8f9fb);
  padding: 12px 16px;
}
.nested-table {
  width: 100%;
  margin-bottom: 8px;
}
.artifact-status {
  color: var(--apt-text-muted, #5c6570);
  font-size: 0.9em;
}
</style>
