# tao

A CLI tool for running Minecraft servers. Built with Deno.

## Installation

Requires [Deno](https://deno.land/) and Java (for running the Minecraft server).

```bash
# Install globally
deno task install

# Or run directly
deno task start <command>
```

## Usage

```bash
tao setup    # Download server jar and create necessary files
tao start    # Start the Minecraft server
tao stop     # Stop the Minecraft server
tao config   # Configure server settings (ops, etc.)
```

## Configuration

Edit `servers.json` to customize your server:

```json
{
  "server": {
    "version": "1.21.4",
    "memory": "2G",
    "port": 25565,
    "gamemode": "survival",
    "difficulty": "normal",
    "maxPlayers": 20,
    "motd": "A Minecraft Server managed by tao",
    "onlineMode": true,
    "whitelist": false
  }
}
```

## Commands

### `tao setup`

Creates all necessary artifacts for running the server:
- Downloads the Minecraft server JAR from Mojang
- Creates `eula.txt` (auto-accepts EULA)
- Generates `server.properties` from config
- Creates an executable `start.sh` script

### `tao start`

Starts the Minecraft server with the configured memory allocation. The server runs in the foreground with full console access.

### `tao stop`

Gracefully stops the running server by sending SIGTERM. Waits 30 seconds for graceful shutdown before force-killing.

### `tao config`

Interactive CLI for server configuration:
- List, add, and remove server operators (ops)
- Automatically fetches player UUIDs from Mojang API

## Server Files

All server files are stored in the `./server` directory:
- `server-<version>.jar` - Minecraft server JAR
- `server.properties` - Server configuration
- `ops.json` - Server operators
- `eula.txt` - EULA acceptance
- `world/` - World data (created on first run)
