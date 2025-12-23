import Logger from "../utils/logger.ts";

const SERVER_DIR = "./server";
const OPS_FILE = `${SERVER_DIR}/ops.json`;
const CONFIG_FILE = "./servers.json";

interface ServerConfig {
  server: {
    version?: string;
    memory?: string;
    port?: number;
    gamemode?: string;
    difficulty?: string;
    maxPlayers?: number;
    motd?: string;
    onlineMode?: boolean;
    whitelist?: boolean;
  };
}

async function readConfig(): Promise<ServerConfig> {
  try {
    const content = await Deno.readTextFile(CONFIG_FILE);
    return JSON.parse(content);
  } catch {
    return { server: {} };
  }
}

async function writeConfig(config: ServerConfig): Promise<void> {
  await Deno.writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

interface Op {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

async function readOps(): Promise<Op[]> {
  try {
    const content = await Deno.readTextFile(OPS_FILE);
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeOps(ops: Op[]): Promise<void> {
  await Deno.writeTextFile(OPS_FILE, JSON.stringify(ops, null, 2));
}

async function prompt(message: string): Promise<string> {
  const buf = new Uint8Array(1024);
  await Deno.stdout.write(new TextEncoder().encode(message));
  const n = await Deno.stdin.read(buf);
  if (n === null) return "";
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

async function fetchUUID(username: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${username}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    // Format UUID with dashes
    const uuid = data.id;
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  } catch {
    return null;
  }
}

async function listOps(ops: Op[]): Promise<void> {
  if (ops.length === 0) {
    console.log("\nNo ops configured.\n");
    return;
  }
  console.log("\nCurrent ops:");
  console.log("─".repeat(50));
  for (const op of ops) {
    console.log(`  ${op.name} (level ${op.level})`);
  }
  console.log("─".repeat(50) + "\n");
}

async function addOp(ops: Op[]): Promise<Op[]> {
  const username = await prompt("Enter player username: ");
  if (!username) {
    Logger.warn("No username provided.");
    return ops;
  }

  // Check if already an op
  if (ops.some((op) => op.name.toLowerCase() === username.toLowerCase())) {
    Logger.warn(`${username} is already an op.`);
    return ops;
  }

  console.log(`Looking up UUID for ${username}...`);
  const uuid = await fetchUUID(username);

  if (!uuid) {
    Logger.error(`Could not find player: ${username}`);
    return ops;
  }

  const levelStr = await prompt("Op level (1-4, default 4): ");
  const level = levelStr ? parseInt(levelStr, 10) : 4;

  if (level < 1 || level > 4) {
    Logger.error("Op level must be between 1 and 4.");
    return ops;
  }

  const newOp: Op = {
    uuid,
    name: username,
    level,
    bypassesPlayerLimit: false,
  };

  ops.push(newOp);
  Logger.info(`Added ${username} as op (level ${level}).`);
  return ops;
}

async function removeOp(ops: Op[]): Promise<Op[]> {
  if (ops.length === 0) {
    Logger.warn("No ops to remove.");
    return ops;
  }

  await listOps(ops);
  const username = await prompt("Enter username to remove: ");
  if (!username) {
    Logger.warn("No username provided.");
    return ops;
  }

  const index = ops.findIndex(
    (op) => op.name.toLowerCase() === username.toLowerCase()
  );

  if (index === -1) {
    Logger.error(`${username} is not an op.`);
    return ops;
  }

  ops.splice(index, 1);
  Logger.info(`Removed ${username} from ops.`);
  return ops;
}

async function setMemory(config: ServerConfig): Promise<ServerConfig> {
  const currentMemory = config.server.memory || "2G";
  const newMemory = await prompt(`Memory allocation (current: ${currentMemory}): `);

  if (!newMemory) {
    Logger.info("Keeping current memory setting.");
    return config;
  }

  // Validate memory format (e.g., 1G, 2G, 512M, 4096M)
  if (!/^\d+[MG]$/i.test(newMemory)) {
    Logger.error("Invalid format. Use format like '2G' or '1024M'.");
    return config;
  }

  config.server.memory = newMemory.toUpperCase();
  Logger.info(`Memory set to ${config.server.memory}.`);
  return config;
}

export async function config(): Promise<void> {
  // Check if server directory exists
  try {
    await Deno.stat(SERVER_DIR);
  } catch {
    Logger.error("Server directory not found. Run 'tao setup' first.");
    Deno.exit(1);
  }

  let ops = await readOps();
  let serverConfig = await readConfig();

  console.log("\n┌─────────────────────────────────┐");
  console.log("│     tao - Server Configuration  │");
  console.log("└─────────────────────────────────┘\n");

  while (true) {
    const currentMemory = serverConfig.server.memory || "2G";
    console.log("What would you like to do?");
    console.log("  1. List ops");
    console.log("  2. Add op");
    console.log("  3. Remove op");
    console.log(`  4. Set memory (current: ${currentMemory})`);
    console.log("  5. Save and exit");
    console.log("  6. Exit without saving\n");

    const choice = await prompt("Select option (1-6): ");

    switch (choice) {
      case "1":
        await listOps(ops);
        break;
      case "2":
        ops = await addOp(ops);
        break;
      case "3":
        ops = await removeOp(ops);
        break;
      case "4":
        serverConfig = await setMemory(serverConfig);
        break;
      case "5":
        await writeOps(ops);
        await writeConfig(serverConfig);
        Logger.info("Configuration saved.");
        return;
      case "6":
        Logger.info("Exiting without saving.");
        return;
      default:
        Logger.warn("Invalid option. Please select 1-6.");
    }
  }
}
