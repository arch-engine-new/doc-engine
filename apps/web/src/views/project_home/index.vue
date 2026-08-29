<script setup lang="ts">
import StepChat from "../../components/StepChat.vue";
import ProjectHomeDialogs from "./ProjectHomeDialogs.vue";
import ProjectPackTable from "./ProjectPackTable.vue";
import { useProjectHome } from "./useProjectHome";

const home = useProjectHome();
</script>

<template>
  <div class="wrap">
    <h1>项目与规范包</h1>
    <p class="sub">空规范包，无预置公路/水利/房建字样。规范包由用户自行配置。验收 A1。</p>
    <div class="row-actions">
      <label class="filter-label">
        项目名
        <input v-model="home.projectName" type="text" />
      </label>
      <button class="btn" type="button" :disabled="home.busy" @click="home.createProject">新建项目</button>
      <label class="filter-label">
        归属项目
        <select v-model="home.selectedProjectId">
          <option v-for="project in home.projects" :key="project.project_id" :value="project.project_id">
            {{ project.name }}
          </option>
        </select>
      </label>
      <label class="filter-label">
        规范包名
        <input v-model="home.packName" type="text" />
      </label>
      <button class="btn ghost" type="button" :disabled="home.busy || !home.selectedProjectId" @click="home.createPack">
        新建空规范包
      </button>
    </div>
    <p v-if="home.error" class="sub error-text">{{ home.error }}</p>
    <ProjectHomeDialogs
      :rename-target="home.renameTarget"
      :rename-input="home.renameInput"
      :delete-target="home.deleteTarget"
      :new-doc-type-pack-id="home.newDocTypePackId"
      :new-doc-type-name="home.newDocTypeName"
      :new-doc-type-parent-id="home.newDocTypeParentId"
      :field-defs-target="home.fieldDefsTarget"
      :field-defs-draft="home.fieldDefsDraft"
      :doc-types-by-pack="home.docTypesByPack"
      :busy="home.busy"
      :crud-label="home.crudLabel"
      @update:rename-input="home.renameInput = $event"
      @update:new-doc-type-name="home.newDocTypeName = $event"
      @update:new-doc-type-parent-id="home.newDocTypeParentId = $event"
      @submit-rename="home.submitRename"
      @close-rename="home.closeRename"
      @submit-delete="home.submitDelete"
      @close-delete="home.closeDelete"
      @submit-new-doc-type="home.submitNewDocType"
      @close-new-doc-type="home.closeNewDocType"
      @add-field-def-row="home.addFieldDefRow"
      @remove-field-def-row="home.removeFieldDefRow"
      @save-field-defs="home.saveFieldDefs"
      @close-field-defs="home.closeFieldDefs"
    />
    <ProjectPackTable
      :projects="home.projects"
      :packs-by-project="home.packsByProject"
      :doc-types-by-pack="home.docTypesByPack"
      :expanded-pack-id="home.expandedPackId"
      :busy="home.busy"
      :annotate-to="home.annotateTo"
      :annotate-doc-type="home.annotateDocType"
      :has-excel-template="home.hasExcelTemplate"
      :artifact-for-doc-type="home.artifactForDocType"
      :artifact-status-label="home.artifactStatusLabel"
      :is-generating-doc-type="home.isGeneratingDocType"
      @toggle-pack-doc-types="home.togglePackDocTypes"
      @open-field-defs="home.openFieldDefs"
      @create-template-for-doc-type="home.createTemplateForDocType"
      @open-new-doc-type="home.openNewDocType"
      @open-rename-pack="home.openRenamePack"
      @open-delete-pack="home.openDeletePack"
      @open-rename-project="home.openRenameProject"
      @open-delete-project="home.openDeleteProject"
      @generate-inspection-batch="home.generateInspectionBatch"
    />
  </div>
  <StepChat :trace-id="home.traceId" step="configure" />
</template>
