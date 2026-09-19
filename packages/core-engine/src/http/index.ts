export { handleDemoRequest } from "./handle-request.js";
export type { DemoHttpRequest, DemoHttpResponse } from "./handle-request.js";
export {
  DemoHttpSession,
  getSharedSession,
  replaceSharedSession,
} from "./session.js";
export type { DemoResetResult } from "./session.js";
export { DEMO_DICTS } from "./dicts.js";
export {
  coreEngineHttpPlugin,
  createDemoHttpServer,
  nodeRequestToDemo,
  readNodeBody,
  writeDemoJson,
} from "./node.js";
