import Logger from "../utils/logger.ts";

const SERVER_DIR = "./server";
const LOG_FILE = `${SERVER_DIR}/server.log`;

export async function tail(): Promise<void> {
  // Check if log file exists
  try {
    await Deno.stat(LOG_FILE);
  } catch {
    Logger.error("Log file not found. Is the server running?");
    Deno.exit(1);
  }

  Logger.info(`Tailing ${LOG_FILE} (Ctrl+C to exit)...\n`);

  const command = new Deno.Command("tail", {
    args: ["-f", LOG_FILE],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = command.spawn();

  // Handle Ctrl+C gracefully
  Deno.addSignalListener("SIGINT", () => {
    process.kill("SIGTERM");
    Deno.exit(0);
  });

  await process.status;
}
