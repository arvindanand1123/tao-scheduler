import Logger from "../utils/logger.ts";
import { getServerState, setServerStopped } from "../db/db.ts";

function isProcessRunning(pid: number): boolean {
  try {
    Deno.kill(pid, "SIGCONT");
    return true;
  } catch {
    return false;
  }
}

async function waitForProcess(pid: number, timeoutMs: number): Promise<boolean> {
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

  if (state.status !== "running" || !state.pid) {
    Logger.error("No server is currently running.");
    Deno.exit(1);
  }

  const pid = state.pid;

  if (!isProcessRunning(pid)) {
    Logger.warn("Server process is not running. Cleaning up state.");
    setServerStopped();
    return;
  }

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
