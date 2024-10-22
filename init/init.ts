import * as serverConfig from "../servers.json" with { type: "json" };

export async function init() {
  const servers = serverConfig["default"]["servers"];
}
