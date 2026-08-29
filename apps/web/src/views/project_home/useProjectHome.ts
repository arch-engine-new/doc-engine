import { onMounted, reactive, ref } from "vue";
import { rememberDemoNav, resetDemo } from "../../services/demo-session";
import { errorMessage, generateDocument, http, uploadDocumentArtifact } from "../../services/http";
import type {
  DocTypeView,
  DocumentArtifactView,
  FieldDefView,
  ProjectView,
  SpecPackView,
  TemplateView,
} from "../../services/types";

export type CrudTarget =
  | { kind: "project"; project: ProjectView }
  | { kind: "pack"; pack: SpecPackView };

/** Project home page: projects, packs, and DocType configuration. */
export function useProjectHome() {
  const projects = ref<ProjectView[]>([]);
  const packsByProject = ref<Record<string, SpecPackView[]>>({});
  const docTypesByPack = ref<Record<string, DocTypeView[]>>({});
  const expandedPackId = ref("");
  const selectedProjectId = ref("");
  const projectName = ref("演示项目-夹具");
  const packName = ref("空规范包");
  const error = ref("");
  const busy = ref(false);
  const traceId = ref("");

  const renameTarget = ref<CrudTarget | null>(null);
  const renameInput = ref("");
  const deleteTarget = ref<CrudTarget | null>(null);

  const newDocTypePackId = ref("");
  const newDocTypeName = ref("");
  const newDocTypeParentId = ref("");

  const fieldDefsTarget = ref<DocTypeView | null>(null);
  const fieldDefsDraft = ref<Array<{ field_key: string; value_type: string; required: number }>>([]);

  const artifactByDocType = ref<Record<string, DocumentArtifactView>>({});
  const generatingDocTypeId = ref("");

  function excelTemplateFor(pack: SpecPackView, docType: DocTypeView): TemplateView | undefined {
    return pack.templates?.find(
      (tpl) =>
        tpl.doc_type_id === docType.doc_type_id &&
        tpl.layout_kind === "excel" &&
        Boolean(tpl.excel_template_uri),
    );
  }

  function hasExcelTemplate(pack: SpecPackView, docType: DocTypeView): boolean {
    return Boolean(excelTemplateFor(pack, docType));
  }

  function artifactForDocType(docTypeId: string): DocumentArtifactView | undefined {
    return artifactByDocType.value[docTypeId];
  }

  function artifactStatusLabel(status: string): string {
    if (status === "generated") return "已生成";
    if (status === "uploaded") return "已上传";
    return status;
  }

  function isGeneratingDocType(docTypeId: string): boolean {
    return generatingDocTypeId.value === docTypeId;
  }

  function crudLabel(target: CrudTarget): string {
    return target.kind === "project" ? target.project.name : target.pack.name;
  }

  function friendlyCrudError(err: unknown): string {
    const msg = errorMessage(err);
    if (msg.includes("project has spec packs")) {
      return "无法删除：该项目下仍有规范包，请先删除所有规范包。";
    }
    if (msg.includes("spec pack has jobs")) {
      return "无法删除：该规范包仍有关联任务（演示夹具包无法直接删，可新建空包后删无任务包）。";
    }
    return msg;
  }

  async function loadDocTypesForPack(packId: string) {
    const data = await http<{ docTypes: DocTypeView[] }>(`/api/packs/${packId}/doc-types`);
    docTypesByPack.value = { ...docTypesByPack.value, [packId]: data.docTypes };
  }

  async function load() {
    const data = await http<{ projects: ProjectView[] }>("/api/projects");
    projects.value = data.projects;
    const next: Record<string, SpecPackView[]> = {};
    for (const project of data.projects) {
      const packs = await http<{ packs: SpecPackView[] }>(`/api/projects/${project.project_id}/packs`);
      next[project.project_id] = packs.packs;
      for (const pack of packs.packs) {
        await loadDocTypesForPack(pack.pack_id);
      }
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

  /** Create empty pack plus default DocType and starter template. */
  async function createPack() {
    // Create empty pack plus default DocType and starter template for configure flow.
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
      const docTypeRes = await http<{ docType: DocTypeView }>("/api/doc-types", {
        method: "POST",
        body: JSON.stringify({
          packId: packRes.pack.pack_id,
          name: "默认类型",
        }),
      });
      const tpl = await http<{ template: TemplateView }>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          packId: packRes.pack.pack_id,
          name: "空包模板",
          docTypeId: docTypeRes.docType.doc_type_id,
        }),
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

  function togglePackDocTypes(packId: string) {
    expandedPackId.value = expandedPackId.value === packId ? "" : packId;
  }

  function openNewDocType(packId: string) {
    newDocTypePackId.value = packId;
    newDocTypeName.value = "";
    newDocTypeParentId.value = "";
    fieldDefsTarget.value = null;
    error.value = "";
  }

  function closeNewDocType() {
    newDocTypePackId.value = "";
    newDocTypeName.value = "";
    newDocTypeParentId.value = "";
  }

  async function submitNewDocType() {
    const packId = newDocTypePackId.value;
    const name = newDocTypeName.value.trim();
    if (!packId || !name) {
      error.value = "类型名称不能为空";
      return;
    }
    busy.value = true;
    error.value = "";
    try {
      await http("/api/doc-types", {
        method: "POST",
        body: JSON.stringify({
          packId,
          name,
          parentDocTypeId: newDocTypeParentId.value || null,
        }),
      });
      closeNewDocType();
      await loadDocTypesForPack(packId);
      await load();
    } catch (err) {
      error.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function openFieldDefs(docType: DocTypeView) {
    fieldDefsTarget.value = docType;
    newDocTypePackId.value = "";
    error.value = "";
    busy.value = true;
    try {
      const data = await http<{ fieldDefs: FieldDefView[] }>(`/api/doc-types/${docType.doc_type_id}/field-defs`);
      fieldDefsDraft.value = data.fieldDefs.map((def) => ({
        field_key: def.field_key,
        value_type: def.value_type,
        required: def.required ?? 0,
      }));
      if (fieldDefsDraft.value.length === 0) {
        fieldDefsDraft.value.push({ field_key: "", value_type: "string", required: 0 });
      }
    } catch (err) {
      error.value = errorMessage(err);
      fieldDefsTarget.value = null;
    } finally {
      busy.value = false;
    }
  }

  function closeFieldDefs() {
    fieldDefsTarget.value = null;
    fieldDefsDraft.value = [];
  }

  function addFieldDefRow() {
    fieldDefsDraft.value.push({ field_key: "", value_type: "string", required: 0 });
  }

  function removeFieldDefRow(index: number) {
    fieldDefsDraft.value.splice(index, 1);
  }

  async function saveFieldDefs() {
    const target = fieldDefsTarget.value;
    if (!target) return;
    const defs = fieldDefsDraft.value
      .map((row) => ({
        field_key: row.field_key.trim(),
        value_type: row.value_type.trim() || "string",
        required: row.required ? 1 : 0,
      }))
      .filter((row) => row.field_key);
    busy.value = true;
    error.value = "";
    try {
      await http(`/api/doc-types/${target.doc_type_id}/field-defs`, {
        method: "PUT",
        body: JSON.stringify({ fieldDefs: defs }),
      });
      closeFieldDefs();
      await loadDocTypesForPack(target.pack_id);
    } catch (err) {
      error.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  async function createTemplateForDocType(pack: SpecPackView, docType: DocTypeView) {
    busy.value = true;
    error.value = "";
    try {
      const tpl = await http<{ template: TemplateView }>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          packId: pack.pack_id,
          docTypeId: docType.doc_type_id,
          name: `${docType.name}模板`,
        }),
      });
      rememberDemoNav({
        projectId: pack.project_id,
        packId: pack.pack_id,
        templateId: tpl.template.template_id,
      });
      await load();
    } catch (err) {
      error.value = errorMessage(err);
    } finally {
      busy.value = false;
    }
  }

  function annotateDocType(pack: SpecPackView, docType: DocTypeView): string {
    const tpl = pack.templates?.find((t) => t.doc_type_id === docType.doc_type_id);
    if (tpl) return `/templates/${tpl.template_id}/annotate`;
    return annotateTo(pack);
  }

  /** Generate Excel inspection batch then upload via adapter (demo fill rules apply). */
  async function generateInspectionBatch(
    project: ProjectView,
    pack: SpecPackView,
    docType: DocTypeView,
  ) {
    const template = excelTemplateFor(pack, docType);
    if (!template) {
      error.value = "该文档类型无 Excel 模板，请先上传模板并配置映射。";
      return;
    }
    generatingDocTypeId.value = docType.doc_type_id;
    busy.value = true;
    error.value = "";
    try {
      const generated = await generateDocument(project.project_id, {
        docTypeId: docType.doc_type_id,
        templateId: template.template_id,
        traceId: traceId.value || undefined,
      });
      artifactByDocType.value = {
        ...artifactByDocType.value,
        [docType.doc_type_id]: generated.artifact,
      };
      traceId.value = generated.artifact.trace_id;
      rememberDemoNav({ projectId: project.project_id, packId: pack.pack_id, traceId: generated.artifact.trace_id });

      const uploaded = await uploadDocumentArtifact(project.project_id, generated.artifact.artifact_id);
      artifactByDocType.value = {
        ...artifactByDocType.value,
        [docType.doc_type_id]: uploaded.artifact,
      };
      traceId.value = uploaded.artifact.trace_id;
      rememberDemoNav({ traceId: uploaded.artifact.trace_id });
    } catch (err) {
      error.value = errorMessage(err);
    } finally {
      generatingDocTypeId.value = "";
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

  /** Rename project or pack; rejects industry preset names on packs. */
  async function submitRename() {
    // PATCH project or pack name; pack renames reject industry preset substrings.
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

  // reactive() so template `home.xxx` auto-unwraps nested refs (plain object would white-screen v-for).
  return reactive({
    projects,
    packsByProject,
    docTypesByPack,
    expandedPackId,
    selectedProjectId,
    projectName,
    packName,
    error,
    busy,
    traceId,
    renameTarget,
    renameInput,
    deleteTarget,
    newDocTypePackId,
    newDocTypeName,
    newDocTypeParentId,
    fieldDefsTarget,
    fieldDefsDraft,
    artifactByDocType,
    generatingDocTypeId,
    hasExcelTemplate,
    artifactForDocType,
    artifactStatusLabel,
    isGeneratingDocType,
    crudLabel,
    createProject,
    createPack,
    annotateTo,
    togglePackDocTypes,
    openNewDocType,
    closeNewDocType,
    submitNewDocType,
    openFieldDefs,
    closeFieldDefs,
    addFieldDefRow,
    removeFieldDefRow,
    saveFieldDefs,
    createTemplateForDocType,
    annotateDocType,
    generateInspectionBatch,
    openRenameProject,
    openRenamePack,
    closeRename,
    submitRename,
    openDeleteProject,
    openDeletePack,
    closeDelete,
    submitDelete,
  });
}
