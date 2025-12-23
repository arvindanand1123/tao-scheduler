import Logger from "../utils/logger.ts";

const SERVER_DIR = "./server";
const PID_FILE = `${SERVER_DIR}/server.pid`;

async function getServerPid(): Promise<number | null> {
  try {
    const pidText = await Deno.readTextFile(PID_FILE);
    return parseInt(pidText.trim(), 10);
  } catch {
    return null;
  }
}

async function isProcessRunning(pid: number): Promise<boolean> {
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
    if (!(await isProcessRunning(pid))) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export async function stop(): Promise<void> {
  Logger.info("Stopping Minecraft server...");

  const pid = await getServerPid();

  if (pid === null) {
    Logger.error("No server PID file found. Is the server running?");
    Deno.exit(1);
  }

  if (!(await isProcessRunning(pid))) {
    Logger.warn("Server process is not running. Cleaning up PID file.");
    try {
      await Deno.remove(PID_FILE);
    } catch {
      // Ignore
    }
    return;
  }

  Logger.info(`Sending SIGTERM to process ${pid}...`);

  try {
    // Send SIGTERM for graceful shutdown
    Deno.kill(pid, "SIGTERM");
  } catch (error) {
    Logger.error(`Failed to send signal: ${error}`);
    Deno.exit(1);
  }

  Logger.info("Waiting for server to shut down gracefully (30s timeout)...");

  // Wait for graceful shutdown
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

  // Clean up PID file
  try {
    await Deno.remove(PID_FILE);
  } catch {
    // Ignore if already removed
  }

  Logger.info("Server stopped successfully.");
}
