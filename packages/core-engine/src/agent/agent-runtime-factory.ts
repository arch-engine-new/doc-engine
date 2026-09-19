import { join } from "node:path";
import {
  createControlPlane,
  FakeLlmProvider,
  initDefaultLlmProvider,
  setDefaultLlmProvider,
  setDefaultRegistry,
  SQLiteStateStore,
  type ControlPlane,
  type ToolRegistry,
} from "agent-runtime";
import type { JobPipeline } from "../pipeline/job-pipeline.js";
import { buildJobStepGraphDefinition } from "./job-step-orchestrator.js";
import { resolveRepoRoot } from "./repo-root.js";
import { JobStepOrchestrator } from "./job-step-orchestrator.js";
import { buildStepChatGraphDefinition, StepChatBridge } from "./step-chat-bridge.js";
import { createStepChatRegistry } from "./tools.js";

export interface AgentRuntimeFactoryOptions {
  pipeline: JobPipeline;
  projectRoot?: string;
  /**
   * Explicit test injection of FakeLlmProvider (deterministic echo).
   * Omit on user/demo sessions so missing llm.json uses UnconfiguredLlmProvider.
   */
  forceFakeLlm?: boolean;
  /** Override agent state DB path (`:memory:` in tests). */
  storePath?: string;
}

/**
 * Single ControlPlane + ToolRegistry for StepChat and Job step orchestration.
 */
export class AgentRuntimeFactory {
  private static readonly cache = new WeakMap<JobPipeline, AgentRuntimeFactory>();

  readonly plane: ControlPlane;
  readonly store: SQLiteStateStore;
  readonly registry: ToolRegistry;
  readonly projectRoot: string;
  private readonly pipeline: JobPipeline;

  private stepChatBridge: StepChatBridge | null = null;
  private jobStepOrchestrator: JobStepOrchestrator | null = null;

  private constructor(
    plane: ControlPlane,
    store: SQLiteStateStore,
    registry: ToolRegistry,
    projectRoot: string,
    pipeline: JobPipeline,
  ) {
    this.plane = plane;
    this.store = store;
    this.registry = registry;
    this.projectRoot = projectRoot;
    this.pipeline = pipeline;
  }

  static async getOrCreate(options: AgentRuntimeFactoryOptions): Promise<AgentRuntimeFactory> {
    const cached = AgentRuntimeFactory.cache.get(options.pipeline);
    if (cached) return cached;

    const factory = await AgentRuntimeFactory.bootstrap(options);
    AgentRuntimeFactory.cache.set(options.pipeline, factory);
    return factory;
  }

  private static async bootstrap(options: AgentRuntimeFactoryOptions): Promise<AgentRuntimeFactory> {
    const projectRoot = options.projectRoot ?? resolveRepoRoot();
    const registry = createStepChatRegistry(options.pipeline);
    setDefaultRegistry(registry);

    // forceFakeLlm is opt-in for tests; default init uses Unconfigured when llm.json is missing.
    if (options.forceFakeLlm) {
      setDefaultLlmProvider(new FakeLlmProvider());
    } else {
      initDefaultLlmProvider(projectRoot);
    }

    const storePath =
      options.storePath ??
      (options.forceFakeLlm ? ":memory:" : join(projectRoot, ".apt", "agent-runtime.db"));
    const store = new SQLiteStateStore(storePath);
    await store.initialize();

    const plane = await createControlPlane(store);
    if (options.forceFakeLlm) {
      setDefaultLlmProvider(new FakeLlmProvider());
    } else {
      // createControlPlane may re-init LLM from cwd; restore repo-root config.
      initDefaultLlmProvider(projectRoot);
    }

    const factory = new AgentRuntimeFactory(plane, store, registry, projectRoot, options.pipeline);

    plane.compileGraph({
      definition: buildStepChatGraphDefinition(options.pipeline, registry),
    });
    plane.compileGraph({
      definition: buildJobStepGraphDefinition(options.pipeline, registry),
    });

    return factory;
  }

  getStepChatBridge(): StepChatBridge {
    if (!this.stepChatBridge) {
      this.stepChatBridge = new StepChatBridge(
        this.plane,
        this.pipeline,
        this.projectRoot,
        this.registry,
      );
    }
    return this.stepChatBridge;
  }

  getJobStepOrchestrator(): JobStepOrchestrator {
    if (!this.jobStepOrchestrator) {
      this.jobStepOrchestrator = new JobStepOrchestrator(
        this.plane,
        this.store,
        this.pipeline,
      );
    }
    return this.jobStepOrchestrator;
  }
}
