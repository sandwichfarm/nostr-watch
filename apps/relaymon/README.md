# Relaymon

Relaymon is a Nostr relay monitoring application written in Deno. It deduplicates, validates, and checks the liveness of relays, then publishes events (such as monitor announcements and relay lists) based on configurable settings. Relaymon leverages modular seeding from multiple sources (static configuration, files, database, API, events, subscriptions) and uses SQLite for caching relay statuses. It also implements configurable retry/backoff logic and job scheduling using p-queue.

## Features

- **Monitor Profile Announcement:**  
  Publishes the monitor's profile (metadata) and relay list on startup using the npm:@nostrwatch/announce package.

- **Relay Checks:**  
  Supports configurable tests (e.g., "open", "read") with custom timeouts and expiration settings. Expired relay checks are requeued based on configurable polling intervals and limits.

- **Flexible Seeding:**  
  Aggregates relays from multiple sources:
    - **Config:** A static list provided in the config.
    - **Static File:** YAML or JSON seed file.
    - **Cache:** Relay data stored in a SQLite database.
    - **API:** Fetching relay information from a REST API.
    - **Events:** Extracting relay URLs from Nostr events.
    - **External DB:** Connect to another @nostrwatch/db compatible database to seed relays from all its stored relay URLs.
    - **Subscription:** (Dummy implementation available, extendable for real-time updates.)

- **Retry & Backoff:**  
  Implements customizable backoff logic for failed relay checks.

- **Queue Concurrency:**  
  Uses p-queue with configurable concurrency for check jobs.

## Installation

Ensure Deno is installed.

Clone the repository:
```
    git clone https://github.com/yourusername/relaymon.git
    cd relaymon
```

## Configuration

Relaymon is fully configurable via a YAML file (config.yaml). Below is a sample configuration:

```
monitor:
  slug: trawler.eighteen
  info:
    name: "trawler"
    about: "Trrawls nostr for relays, dedupes, validates, checks liveness, and publishes events."
    nip05: trawler@nostr.watch
  owner: "9bbabc5e36297b6f7d15dd21b90ef85b2f1cb80e15c37fcc0c7f6c05acfd0019"
  geo:
    city: "Frankfurt am Main"
    country: "Germany"
    countryCode: "DE"
    lat: 50.1169
    lon: 8.6821
    region: "Hesse"
    continent: "Europe"

publisher:
  relays:
    - "wss://relay.nostr.watch"
    - "wss://history.nostr.watch"
    - "wss://relaypag.es"

relaymon:
  networks:
    - clearnet
    - tor
    - i2p
  retry:
    expiry:
      - { max: 3, delay: "1m" }
      - { max: 5, delay: "20m" }
      - { max: 7, delay: "1h" }
      - { max: 11, delay: "3h" }
      - { max: 15, delay: "6h" }
      - { max: 22, delay: "24h" }
      - { max: 107, delay: "7d" }
  seed:
    interval: "1m"         # How often to refresh the relay list from all sources
    sources:
      - config              # Seed from a static list provided in the config
      - static              # Seed from a static file (YAML or JSON)
      - cache               # Seed from the SQLite database (relay cache)
      - api                 # Seed from a REST API
      - events              # Seed from Nostr events
      - db                  # Seed from an external @nostrwatch/db database (retrieves all relays regardless of status)
      - subscription        # Seed from relay subscriptions (if available)
    options:
      db:
        path: "./relay.db"  # SQLite database path for storing relay information
        enableWAL: true     # Enable Write-Ahead Logging for the database (for db seeding)
      static:
        path: "./seed.yaml"
      config: []            # Optional static relay list provided in the config
  checks:
    enabled:
      - open
      - read
    options:
      expires: "24h"       # A relay's check is considered expired after 24 hours
      interval: "15s"      # Poll the database for expired relays every 15 seconds
      timeout:
        open: 30000        # 30 seconds timeout for the "open" check
        read: 5000         # 5 seconds timeout for the "read" check
      max: "200"           # Enqueue up to 200 expired relays per polling iteration
      statusInterval: 20   # Show status report every 20 checks

queue:
  workerConcurrency: 20  # p-queue concurrency for check jobs

## Database Configuration

RelayMon uses SQLite to store relay data. You can specify the database path and other settings in the configuration file:

```yaml
relaymon:
  seed:
    options:
      db:
        path: "./custom-database-path.db"  # Custom database path
        enableWAL: true                    # Enable Write-Ahead Logging for better performance (default: true)
```

If no path is specified, RelayMon will use the default database location ("relaymon.db") in the current directory.

### About WAL Mode

Write-Ahead Logging (WAL) is enabled by default to improve database performance. This allows:
- Multiple simultaneous readers even during writes
- Faster write operations
- Better concurrent access for high-volume workloads

If you need to disable WAL mode for any reason, set `enableWAL: false` in the configuration.

## Usage

Run Relaymon with the following command:

    deno run --allow-net --allow-env --allow-read --allow-write --allow-run main.ts

Or, if you have a deno.json configured with tasks:

    deno task start

### Command Line Options

- `-h, --help`: Display the help menu with usage information
- `-c, --config`: Specify the path to the configuration file (default: ./config.yaml)

Examples:

    # Display help menu
    deno run --allow-net --allow-env --allow-read --allow-write --allow-run main.ts --help
    
    # Use a custom config file
    deno run --allow-net --allow-env --allow-read --allow-write --allow-run main.ts -c /path/to/custom-config.yaml
    deno task start -- -c /path/to/custom-config.yaml
    
The status command also supports the config path flag:

    deno run --allow-net --allow-env --allow-read --allow-write --allow-run status.ts -c /path/to/custom-config.yaml
    deno task status -- -c /path/to/custom-config.yaml

### Process Management

Relaymon prevents multiple instances from running simultaneously. If you try to start a second instance, it will display an error message with the PID of the currently running instance:

```
Error: relaymon is already running with PID 12345
To stop it, use: kill 12345
```

RelayMon creates a PID file in the system's temporary directory (e.g., `/tmp` on Linux/macOS or `%TEMP%` on Windows) to track the running instance. The file is automatically cleaned up when the process exits normally.

## Project Structure

```
relaymon/
├── index.ts           # Main entry point
├── config.yaml        # Configuration file
├── data/              # Data directory for database files
├── logs/              # Log files directory
├── src/               # Source code directory
│   ├── core/          # Core application code
│   │   ├── main.ts    # Main application logic
│   │   ├── daemon.ts  # Initializes components and starts monitoring loops
│   │   ├── worker.ts  # Processes relay checks
│   │   ├── seeder.ts  # Aggregates relay list from multiple seed sources
│   │   └── status.ts  # Status reporting utility
│   ├── config/        # Configuration handling
│   │   └── config.ts  # Loads configuration from config.yaml
│   ├── db/            # Database functionality
│   │   ├── db.ts      # Database operations
│   │   └── debugdb.ts # Debug database functionality
│   ├── utils/         # Utility functions
│   │   ├── announce.ts    # Publishes monitor announcement at startup
│   │   ├── queueManager.ts # Manages job queues (check & publish)
│   │   ├── retryManager.ts # Handles retry/backoff logic
│   │   ├── logger.ts      # Logging helper
│   │   ├── header.ts      # Header utilities
│   │   ├── hostnames.ts   # Hostname utilities
│   │   ├── deletion.ts    # Deletion utilities
│   │   └── blocklists.ts  # Blocklist management
│   └── blocklists/    # Blocklist data
├── tests/             # Test files
└── deno.json          # Deno configuration file
```

## Environment Variables

- DAEMON_PRIVKEY: The private key used to sign announcements and events.

## Development

- Formatting: Run `deno fmt` to format the code.
- Linting: Run `deno lint` to lint the code.
- Testing: Run `deno test --allow-net --allow-env --allow-read --allow-write --allow-run` to execute tests.

### Building for Different Platforms

RelayMon can be compiled for different platforms using the provided Deno tasks:

```bash
# Compile for macOS (Intel/AMD64)
deno task compile:macos-x64

# Compile for macOS (ARM64/Apple Silicon)
deno task compile:macos-arm64

# Compile for Linux (x64)
deno task compile:linux-x64

# Compile for Linux (ARM64)
deno task compile:linux-arm64

# Compile for Windows (x64)
deno task compile:windows-x64

# Compile for Windows (ARM64)
deno task compile:windows-arm64

# Compile for all platforms
deno task compile:all
```

The compiled binaries will be created in the `./dist` directory with appropriate names (e.g., `dist/relaymon-macos-x64`, `dist/relaymon-linux-x64`, etc.).

## Contributing

Contributions are welcome! Open an issue or submit a pull request with your changes.

## License

This project is licensed under the MIT License.

## Status Reporting

RelayMon includes an ASCII status report that shows statistics about the queue and relay cache. The status report is displayed after every N checks, where N is configurable in the config.yaml file:

The status report includes:

### Queue Stats
- Active: Number of relay checks currently in progress
- Completed: Number of completed relay checks
- Failed: Number of failed relay checks
- Waiting: Number of relay checks waiting to be processed
- Paused: Whether the queue is paused (0 = not paused, 1 = paused)
- Total Queue: Total number of checks in the queue

### Cache Stats
- Online: Number of relays that are currently online
- Offline: Number of relays that are currently offline
- Expired: Number of relays that need to be checked
- Unchecked: Number of relays that have never been checked
- Ignored: Number of relays that are ignored
- Parents: Number of relays that have child relays
- Children: Number of relays that have a parent
- Total: Total number of relays in the database

The status report provides a quick overview of the current state of RelayMon and helps monitor its performance.

## Database Migration

### Network Type Migration

RelayMon includes a network migration feature to fix the network types of relays already in your database. You can run this migration when starting the application:

```bash
# Run migration before starting the monitor
deno run --allow-read --allow-write --allow-net main.ts --migrate

# Run migration with a custom config file
deno run --allow-read --allow-write --allow-net main.ts -c /path/to/custom-config.yaml --migrate
```

The migration:
1. Reads all relay URLs from your database
2. Uses `parseRelayNetwork` to determine the correct network type for each URL
3. Updates the database with the correct network type
4. Provides detailed statistics about the changes made

This is particularly useful when:
- You've imported relay URLs from sources that didn't correctly identify network types
- You're seeing relays from unwanted networks (like .onion addresses) in your results
- You've updated from a version that didn't properly set network types

After running the migration, you'll get a full report of changes made, including:
- Total relays updated vs. unchanged
- Network distribution after migration
- Detailed breakdown of which network types were changed and how many

## Database Check Utility

RelayMon includes a database check utility that helps identify and fix common database issues, particularly duplicate relay entries that can cause unexpected behavior. You can run this utility as follows:

```bash
# Run the database check
deno task dbcheck

# Run with a compiled binary
./relaymon-dbcheck
```

### Features

The dbcheck utility performs the following checks:

1. **Database Integrity Check**: Verifies the overall integrity of the SQLite database
2. **Duplicate Relay Detection**: Identifies any relay URLs that have multiple entries in the database, despite the schema having a PRIMARY KEY constraint
3. **Detailed Reporting**: Shows comprehensive information about each duplicate, including when it was last checked, retry counts, and online status

### Fixing Issues

The utility offers two methods to fix duplicates:

```bash
# Automatically fix issues by keeping the most relevant entry
deno task dbcheck -- --fix=auto

# Move duplicates to a backup table for future reference
deno task dbcheck -- --fix=backup
```

The auto-fix strategy:
- If one record has never been checked (`checked_at=-1`) and another has been checked, it keeps the checked one
- If multiple records have been checked, it keeps the newest one (highest rowid)
- For all other cases, it keeps the record with the highest rowid

This helps resolve issues where relays are continuously enqueued despite having high retry counts and appropriate backoff periods set.

### Compiling the Utility

You can compile the utility to a standalone binary:

```bash
# Compile the dbcheck utility
deno task compile:dbcheck
```

The compiled binary will be created at `./dist/relaymon-dbcheck` and can be run directly without Deno installed.