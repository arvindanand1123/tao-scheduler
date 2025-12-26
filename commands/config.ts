import Logger from "../utils/logger.ts";

const SERVER_DIR = "./server";
const OPS_FILE = `${SERVER_DIR}/ops.json`;
const WHITELIST_FILE = `${SERVER_DIR}/whitelist.json`;
const BANNED_PLAYERS_FILE = `${SERVER_DIR}/banned-players.json`;
const SERVER_PROPERTIES_FILE = `${SERVER_DIR}/server.properties`;
const USERCACHE_FILE = `${SERVER_DIR}/usercache.json`;
const SERVER_LOG_FILE = `${SERVER_DIR}/logs/latest.log`;
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

interface WhitelistPlayer {
  uuid: string;
  name: string;
}

interface BannedPlayer {
  uuid: string;
  name: string;
  created: string;
  source: string;
  reason: string;
  expires: string;
}

interface UserCachePlayer {
  name: string;
  uuid: string;
  expiresOn: string;
}

interface PlayerWithIP {
  name: string;
  uuid: string;
  ip?: string;
  lastSeen?: string;
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

async function readWhitelist(): Promise<WhitelistPlayer[]> {
  try {
    const content = await Deno.readTextFile(WHITELIST_FILE);
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeWhitelist(whitelist: WhitelistPlayer[]): Promise<void> {
  await Deno.writeTextFile(WHITELIST_FILE, JSON.stringify(whitelist, null, 2));
}

async function readBannedPlayers(): Promise<BannedPlayer[]> {
  try {
    const content = await Deno.readTextFile(BANNED_PLAYERS_FILE);
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeBannedPlayers(banned: BannedPlayer[]): Promise<void> {
  await Deno.writeTextFile(BANNED_PLAYERS_FILE, JSON.stringify(banned, null, 2));
}

async function readUserCache(): Promise<UserCachePlayer[]> {
  try {
    const content = await Deno.readTextFile(USERCACHE_FILE);
    return JSON.parse(content);
  } catch {
    return [];
  }
}


async function warnIfWhitelistDisabled(): Promise<boolean> {
  let enabled: boolean;
  try {
    const content = await Deno.readTextFile(SERVER_PROPERTIES_FILE);
    enabled =  content.includes("white-list=true");
  } catch {
    enabled = false
  }
  if (!enabled) {
    Logger.warn("Whitelist is currently DISABLED in server.properties.");
    const proceed = await prompt("Do you want to continue anyway? (y/n): ");
    return proceed.toLowerCase() === "y";
  }
  return true;
}

async function parsePlayerIPsFromLogs(): Promise<Map<string, { ip: string; lastSeen: string }>> {
  const playerIPs = new Map<string, { ip: string; lastSeen: string }>();
  try {
    const content = await Deno.readTextFile(SERVER_LOG_FILE);
    const lines = content.split("\n");

    // Match patterns like: [16:45:23] [Server thread/INFO]: PlayerName[/192.168.1.100:54321] logged in
    const loginPattern = /\[(\d{2}:\d{2}:\d{2})\].*?:\s+(\w+)\[\/([0-9.]+):\d+\]\s+logged in/;

    for (const line of lines) {
      const match = line.match(loginPattern);
      if (match) {
        const [, time, name, ip] = match;
        playerIPs.set(name.toLowerCase(), { ip, lastSeen: time });
      }
    }
  } catch {
    // Log file doesn't exist or can't be read
  }
  return playerIPs;
}

async function getAllPlayers(): Promise<PlayerWithIP[]> {
  const userCache = await readUserCache();
  const playerIPs = await parsePlayerIPsFromLogs();

  return userCache.map((player) => {
    const ipInfo = playerIPs.get(player.name.toLowerCase());
    return {
      name: player.name,
      uuid: player.uuid,
      ip: ipInfo?.ip,
      lastSeen: ipInfo?.lastSeen,
    };
  });
}

async function enableWhitelistInProperties(): Promise<void> {
  try {
    let content = await Deno.readTextFile(SERVER_PROPERTIES_FILE);
    if (content.includes("white-list=false")) {
      content = content.replace("white-list=false", "white-list=true");
      await Deno.writeTextFile(SERVER_PROPERTIES_FILE, content);
      Logger.info("Enabled whitelist in server.properties");
    }
  } catch {
    Logger.warn("server.properties not found. Run 'tao setup' to create it.");
  }
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

async function listWhitelist(whitelist: WhitelistPlayer[]): Promise<void> {
  if (whitelist.length === 0) {
    console.log("\nNo players whitelisted.\n");
    return;
  }
  console.log("\nWhitelisted players:");
  console.log("─".repeat(50));
  for (const player of whitelist) {
    console.log(`  ${player.name}`);
  }
  console.log("─".repeat(50) + "\n");
}

async function listAllPlayers(): Promise<void> {
  const players = await getAllPlayers();
  if (players.length === 0) {
    console.log("\nNo players have logged into the server yet.\n");
    return;
  }
  console.log("\nAll players who have logged in:");
  console.log("─".repeat(60));
  console.log("  Name                 IP               Last Seen");
  console.log("─".repeat(60));
  for (const player of players) {
    const ip = player.ip || "N/A";
    const lastSeen = player.lastSeen || "N/A";
    console.log(`  ${player.name.padEnd(20)} ${ip.padEnd(16)} ${lastSeen}`);
  }
  console.log("─".repeat(60) + "\n");
}

async function listBannedPlayers(banned: BannedPlayer[]): Promise<void> {
  if (banned.length === 0) {
    console.log("\nNo players banned.\n");
    return;
  }
  console.log("\nBanned players:");
  console.log("─".repeat(60));
  for (const player of banned) {
    console.log(`  ${player.name} - ${player.reason}`);
    console.log(`    Banned: ${player.created} | Expires: ${player.expires}`);
  }
  console.log("─".repeat(60) + "\n");
}

async function banPlayer(banned: BannedPlayer[]): Promise<BannedPlayer[]> {
  const username = await prompt("Enter player username to ban: ");
  if (!username) {
    Logger.warn("No username provided.");
    return banned;
  }

  // Check if already banned
  if (banned.some((p) => p.name.toLowerCase() === username.toLowerCase())) {
    Logger.warn(`${username} is already banned.`);
    return banned;
  }

  console.log(`Looking up UUID for ${username}...`);
  const uuid = await fetchUUID(username);

  if (!uuid) {
    Logger.error(`Could not find player: ${username}`);
    return banned;
  }

  const reason = await prompt("Enter ban reason (default: Banned by admin): ");
  const banReason = reason || "Banned by admin";

  const newBan: BannedPlayer = {
    uuid,
    name: username,
    created: new Date().toISOString(),
    source: "tao",
    reason: banReason,
    expires: "forever",
  };

  banned.push(newBan);
  Logger.info(`Banned ${username}. Reason: ${banReason}`);
  return banned;
}

async function unbanPlayer(banned: BannedPlayer[]): Promise<BannedPlayer[]> {
  if (banned.length === 0) {
    Logger.warn("No players to unban.");
    return banned;
  }

  await listBannedPlayers(banned);
  const username = await prompt("Enter username to unban: ");
  if (!username) {
    Logger.warn("No username provided.");
    return banned;
  }

  const index = banned.findIndex(
    (p) => p.name.toLowerCase() === username.toLowerCase()
  );

  if (index === -1) {
    Logger.error(`${username} is not banned.`);
    return banned;
  }

  banned.splice(index, 1);
  Logger.info(`Unbanned ${username}.`);
  return banned;
}

async function addToWhitelist(whitelist: WhitelistPlayer[]): Promise<WhitelistPlayer[]> {
  const shouldProceed = await warnIfWhitelistDisabled();
  if (!shouldProceed) {
    return whitelist;
  }

  const username = await prompt("Enter player username: ");
  if (!username) {
    Logger.warn("No username provided.");
    return whitelist;
  }

  // Check if already whitelisted
  if (whitelist.some((p) => p.name.toLowerCase() === username.toLowerCase())) {
    Logger.warn(`${username} is already whitelisted.`);
    return whitelist;
  }

  console.log(`Looking up UUID for ${username}...`);
  const uuid = await fetchUUID(username);

  if (!uuid) {
    Logger.error(`Could not find player: ${username}`);
    return whitelist;
  }

  const newPlayer: WhitelistPlayer = {
    uuid,
    name: username,
  };

  whitelist.push(newPlayer);
  Logger.info(`Added ${username} to whitelist.`);
  return whitelist;
}

async function removeFromWhitelist(whitelist: WhitelistPlayer[]): Promise<WhitelistPlayer[]> {
  if (whitelist.length === 0) {
    Logger.warn("No players to remove from whitelist.");
    return whitelist;
  }

  const shouldProceed = await warnIfWhitelistDisabled();
  if (!shouldProceed) {
    return whitelist;
  }

  await listWhitelist(whitelist);
  const username = await prompt("Enter username to remove: ");
  if (!username) {
    Logger.warn("No username provided.");
    return whitelist;
  }

  const index = whitelist.findIndex(
    (p) => p.name.toLowerCase() === username.toLowerCase()
  );

  if (index === -1) {
    Logger.error(`${username} is not whitelisted.`);
    return whitelist;
  }

  whitelist.splice(index, 1);
  Logger.info(`Removed ${username} from whitelist.`);
  return whitelist;
}

async function manageOps(ops: Op[]): Promise<Op[]> {
  while (true) {
    console.log("\n    Manage Ops:");
    console.log("      1. List ops");
    console.log("      2. Add op");
    console.log("      3. Remove op");
    console.log("      4. Back\n");

    const choice = await prompt("    Select option (1-4): ");

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
        return ops;
      default:
        Logger.warn("Invalid option. Please select 1-4.");
    }
  }
}

async function manageWhitelist(whitelist: WhitelistPlayer[]): Promise<WhitelistPlayer[]> {
  while (true) {
    console.log("\n    Manage Whitelist:");
    console.log("      1. List whitelist");
    console.log("      2. Add to whitelist");
    console.log("      3. Remove from whitelist");
    console.log("      4. Back\n");

    const choice = await prompt("    Select option (1-4): ");

    switch (choice) {
      case "1":
        await listWhitelist(whitelist);
        break;
      case "2":
        whitelist = await addToWhitelist(whitelist);
        break;
      case "3":
        whitelist = await removeFromWhitelist(whitelist);
        break;
      case "4":
        return whitelist;
      default:
        Logger.warn("Invalid option. Please select 1-4.");
    }
  }
}

async function manageBans(banned: BannedPlayer[]): Promise<BannedPlayer[]> {
  while (true) {
    console.log("\n    Manage Bans:");
    console.log("      1. List banned players");
    console.log("      2. Ban player");
    console.log("      3. Unban player");
    console.log("      4. Back\n");

    const choice = await prompt("    Select option (1-4): ");

    switch (choice) {
      case "1":
        await listBannedPlayers(banned);
        break;
      case "2":
        banned = await banPlayer(banned);
        break;
      case "3":
        banned = await unbanPlayer(banned);
        break;
      case "4":
        return banned;
      default:
        Logger.warn("Invalid option. Please select 1-4.");
    }
  }
}

interface PlayerManagementState {
  ops: Op[];
  whitelist: WhitelistPlayer[];
  banned: BannedPlayer[];
}

async function managePlayers(state: PlayerManagementState): Promise<PlayerManagementState> {
  while (true) {
    console.log("\n  Manage Players:");
    console.log("    1. List all players (who have logged in)");
    console.log("    2. Manage whitelist");
    console.log("    3. Manage ops");
    console.log("    4. Manage bans");
    console.log("    5. Back\n");

    const choice = await prompt("  Select option (1-5): ");

    switch (choice) {
      case "1":
        await listAllPlayers();
        break;
      case "2":
        state.whitelist = await manageWhitelist(state.whitelist);
        break;
      case "3":
        state.ops = await manageOps(state.ops);
        break;
      case "4":
        state.banned = await manageBans(state.banned);
        break;
      case "5":
        return state;
      default:
        Logger.warn("Invalid option. Please select 1-5.");
    }
  }
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
  let whitelist = await readWhitelist();
  let banned = await readBannedPlayers();
  let serverConfig = await readConfig();

  console.log("\n┌─────────────────────────────────┐");
  console.log("│     tao - Server Configuration  │");
  console.log("└─────────────────────────────────┘\n");

  while (true) {
    const currentMemory = serverConfig.server.memory || "2G";
    console.log("What would you like to do?");
    console.log("  1. Manage players");
    console.log("       ├─ List all players");
    console.log("       ├─ Manage whitelist");
    console.log("       ├─ Manage ops");
    console.log("       └─ Manage bans");
    console.log(`  2. Set memory (current: ${currentMemory})`);
    console.log("  3. Save and exit");
    console.log("  4. Exit without saving\n");

    const choice = await prompt("Select option (1-4): ");

    switch (choice) {
      case "1": {
        const state = await managePlayers({ ops, whitelist, banned });
        ops = state.ops;
        whitelist = state.whitelist;
        banned = state.banned;
        break;
      }
      case "2":
        serverConfig = await setMemory(serverConfig);
        break;
      case "3":
        await writeOps(ops);
        await writeWhitelist(whitelist);
        await writeBannedPlayers(banned);
        await writeConfig(serverConfig);
        Logger.info("Configuration saved.");
        return;
      case "4":
        Logger.info("Exiting without saving.");
        return;
      default:
        Logger.warn("Invalid option. Please select 1-4.");
    }
  }
}
