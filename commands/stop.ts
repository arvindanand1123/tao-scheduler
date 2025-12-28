import Logger from "../utils/logger.ts";
import { getServerState, setServerStopped } from "../db/db.ts";

const SERVER_DIR = "./server";

async function findServerPid(): Promise<number | null> {
  try {
    const absoluteServerDir = await Deno.realPath(SERVER_DIR);
    // Find java process running the minecraft server jar in our server directory
    const command = new Deno.Command("pgrep", {
      args: ["-f", `java.*-jar.*server-.*\\.jar`],
      stdout: "piped",
      stderr: "null",
    });
    const output = await command.output();
    const pids = new TextDecoder()
      .decode(output.stdout)
      .trim()
      .split("\n")
      .filter((p) => p)
      .map((p) => parseInt(p, 10));

    if (pids.length > 0) {
      return pids[0];
    }
    return null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    Deno.kill(pid, "SIGCONT");
    return true;
  } catch {
    return false;
  }
}

async function waitForProcess(
  pid: number,
  timeoutMs: number,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export async function stop(): Promise<void> {
  Logger.info("Stopping Minecraft server...");

  const state = getServerState();

  if (state.status !== "running") {
    Logger.error("No server is currently running.");
    Deno.exit(1);
  }

  // Find the actual Java process
  const pid = await findServerPid();

  if (!pid) {
    Logger.warn("Server process not found. Cleaning up state.");
    setServerStopped();
    return;
  }

  Logger.info(`Found server process with PID: ${pid}`);
  Logger.info(`Sending SIGTERM to process ${pid}...`);

  try {
    Deno.kill(pid, "SIGTERM");
  } catch (error) {
    Logger.error(`Failed to send signal: ${error}`);
    Deno.exit(1);
  }

  Logger.info("Waiting for server to shut down gracefully (30s timeout)...");

  const stopped = await waitForProcess(pid, 30000);

  if (!stopped) {
    Logger.warn("Server did not stop gracefully. Sending SIGKILL...");
    try {
      Deno.kill(pid, "SIGKILL");
    } catch {
      // Process may have stopped
    }
    await waitForProcess(pid, 5000);
  }

  // Update state in database
  setServerStopped();

  Logger.info("Server stopped successfully.");
}
