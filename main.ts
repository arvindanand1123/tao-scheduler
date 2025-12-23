import { setup } from "./commands/setup.ts";
import { start } from "./commands/start.ts";
import { stop } from "./commands/stop.ts";
import { config } from "./commands/config.ts";
import Logger from "./utils/logger.ts";

function printUsage(): void {
  console.log(`
tao - Minecraft Server Manager

Usage:
  tao <command>

Commands:
  setup    Create all necessary artifacts for running the server
  start    Start the Minecraft server
  stop     Stop the Minecraft server
  config   Configure server settings (ops, etc.)

Examples:
  tao setup
  tao start
  tao stop
  tao config
`);
}

async function main() {
  const args = Deno.args;

  if (args.length === 0) {
    printUsage();
    Deno.exit(0);
  }

  const command = args[0];

  switch (command) {
    case "setup":
      await setup();
      break;
    case "start":
      await start();
      break;
    case "stop":
      await stop();
      break;
    case "config":
      await config();
      break;
    case "help":
    case "--help":
    case "-h":
      printUsage();
      break;
    default:
      Logger.error(`Unknown command: ${command}`);
      printUsage();
      Deno.exit(1);
  }
}

main().catch((error) => {
  Logger.error(`An error occurred: ${error.message}`);
  Deno.exit(1);
});
