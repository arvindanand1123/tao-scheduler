# tao-scheduler

## Overview

Tao Scheduler is a balanced and efficient server management tool designed for
running multiple Minecraft servers. Whether your server is modded with a custom
world file or just plain vanilla, Tao will run it.Built with Deno, it aims to
simplify the process of managing, monitoring, and maintaining multiple Minecraft
server instances on a single machine.

## Problem Statement

Managing multiple Minecraft servers can be challenging, especially when dealing
with different versions, mod packs, and potential server crashes. Tao Scheduler
addresses these issues by providing:

1. Automated initialization and dependency management
2. Continuous health monitoring
3. Automatic crash recovery with retry logic

## Key Features

- **Multi-Server Support**: Manage multiple Minecraft servers with varying
  configurations from a single tool.
- **Automated Dependency Management**: Easily handle different Minecraft
  versions and mod packs.
- **Crash Recovery**: Automatically attempt to revive crashed servers with
  exponential backoff.
- **Persistent State Management**: Utilize SQLite to maintain server status and
  retry information.
- **Extensible Design**: Built with Deno for modern TypeScript support and easy
  module management.

## Getting Started

TBD

---

Tao Scheduler aims to bring balance and efficiency to Minecraft server
management, allowing server administrators to focus on building great gaming
experiences rather than constantly monitoring and restarting servers.
