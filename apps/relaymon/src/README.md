# RelayMon Source Code Structure

This directory contains the source code for RelayMon, organized into the following directories:

## Directory Structure

- `core/`: Core application functionality
  - `main.ts`: Application entry point
  - `worker.ts`: Worker implementation for processing relay checks
  - `daemon.ts`: Daemon process that manages the monitoring service
  - `seeder.ts`: Functionality for seeding relay information
  - `status.ts`: Status reporting functions

- `db/`: Database access and management
  - `db.ts`: Main database functions
  - `debugdb.ts`: Debug database functionality

- `utils/`: Utility functions and helpers
  - `logger.ts`: Logging functionality
  - `header.ts`: Header management
  - `queueManager.ts`: Queue management
  - `retryManager.ts`: Retry logic
  - `hostnames.ts`: Hostname utilities
  - `announce.ts`: Announcement functionality
  - `deletion.ts`: Deletion utilities
  - `blocklists.ts`: Blocklist management

- `config/`: Configuration management
  - `config.ts`: Configuration loading and parsing

- `blocklists/`: Blocklist data

## Usage

The application is started from the root directory using:

```
deno task start
```

This runs the entry point at `index.ts` which loads the main module from `src/core/main.ts`. 