import Logger from "../utils/logger.ts";
import { getServerState, setServerRunning } from "../db/db.ts";
import * as config from "../servers.json" with { type: "json" };

const SERVER_DIR = "./server";

function isProcessRunning(pid: number): boolean {
  try {
    Deno.kill(pid, "SIGCONT");
    return true;
  } catch {
    return false;
  }
}

export async function start(): Promise<void> {
  Logger.info("Starting Minecraft server...");

  // Check if server directory exists
  try {
    await Deno.stat(SERVER_DIR);
  } catch {
    Logger.error("Server directory not found. Run 'tao setup' first.");
    Deno.exit(1);
  }

  // Check current state
  const state = getServerState();
  if (state.status === "running" && state.pid && isProcessRunning(state.pid)) {
    Logger.error(`Server is already running (PID: ${state.pid})`);
    Deno.exit(1);
  }

  const serverConfig = config.default.server || {};
  const version = serverConfig.version || "1.21.4";
  const memory = serverConfig.memory || "2G";
  const jarName = `server-${version}.jar`;
  const jarPath = `${SERVER_DIR}/${jarName}`;

  // Check if jar exists
  try {
    await Deno.stat(jarPath);
  } catch {
    Logger.error(`Server jar not found: ${jarPath}. Run 'tao setup' first.`);
    Deno.exit(1);
  }

  // Resolve absolute path for server directory
  const absoluteServerDir = await Deno.realPath(SERVER_DIR);
  const logFile = `${absoluteServerDir}/server.log`;

  Logger.info(`Starting server with ${memory} memory in background...`);

  // Start the server process in background using shell redirection
  const command = new Deno.Command("sh", {
    args: [
      "-c",
      `java -Xmx${memory} -Xms${memory} -jar ${jarName} nogui > server.log 2>&1`,
    ],
    cwd: absoluteServerDir,
    stdin: "null",
    stdout: "null",
    stderr: "null",
  });

  const process = command.spawn();

  // Don't wait for the process - let it run in background
  process.unref();

  // Save state to database
  setServerRunning(process.pid, version);

  Logger.info(`Server started with PID: ${process.pid}`);
  Logger.info(`Logs: ${logFile}`);
  Logger.info("Use 'tao stop' to stop the server.");
}
