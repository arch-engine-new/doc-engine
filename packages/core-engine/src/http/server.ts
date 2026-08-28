import { createDemoHttpServer } from "./node.js";
import { getSharedSession } from "./session.js";

const port = Number(process.env.CORE_ENGINE_HTTP_PORT ?? 8787);
void getSharedSession()
  .then((session) => session.reset())
  .then(() => {
    createDemoHttpServer(port);
    console.log(`core-engine HTTP adapter on http://127.0.0.1:${port}`);
  });
