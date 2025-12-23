import Logger from "../utils/logger.ts";
import * as config from "../servers.json" with { type: "json" };

const SERVER_DIR = "./server";
const PID_FILE = `${SERVER_DIR}/server.pid`;

async function isServerRunning(): Promise<boolean> {
  try {
    const pidText = await Deno.readTextFile(PID_FILE);
    const pid = parseInt(pidText.trim(), 10);

    // Check if process exists
    try {
      Deno.kill(pid, "SIGCONT");
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      await Deno.remove(PID_FILE);
      return false;
    }
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

  // Check if already running
  if (await isServerRunning()) {
    Logger.error("Server is already running!");
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

  Logger.info(`Starting server with ${memory} memory...`);

  // Start the server process
  const command = new Deno.Command("java", {
    args: [
      `-Xmx${memory}`,
      `-Xms${memory}`,
      "-jar",
      jarName,
      "nogui",
    ],
    cwd: SERVER_DIR,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = command.spawn();

  // Save PID
  await Deno.writeTextFile(PID_FILE, String(process.pid));
  Logger.info(`Server started with PID: ${process.pid}`);
  Logger.info("Server is now running. Use 'tao stop' to stop it.");

  // Wait for the process
  const status = await process.status;

  // Clean up PID file when server stops
  try {
    await Deno.remove(PID_FILE);
  } catch {
    // Ignore if already removed
  }

  if (!status.success) {
    Logger.error(`Server exited with code: ${status.code}`);
    Deno.exit(status.code);
  }

  Logger.info("Server stopped.");
}
