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
      - subscription        # Seed from relay subscriptions (if available)
    options:
      db:
        path: "./relay.db"
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

```

## Usage

Run Relaymon with the following command:

    deno run --allow-net --allow-env --allow-read --allow-write main.ts

Or, if you have a deno.json configured with tasks:

    deno task start

## Project Structure

```
relaymon/
├── main.ts            # Main entry point
├── config.ts          # Loads configuration from config.yaml
├── announce.ts        # Publishes monitor announcement at startup
├── daemon.ts          # Initializes components and starts monitoring loops
├── queueManager.ts    # Manages job queues (check & publish)
├── worker.ts          # Processes relay checks
├── seeder.ts          # Aggregates relay list from multiple seed sources
├── db.ts              # SQLite database operations
├── retryManager.ts    # Handles retry/backoff logic
├── logger.ts          # Logging helper
└── deno.json          # Deno configuration file
```

## Environment Variables

- DAEMON_PRIVKEY: The private key used to sign announcements and events.
- DAEMON_PUBKEY: The public key of the daemon for relay identification.

## Development

- Formatting: Run `deno fmt` to format the code.
- Linting: Run `deno lint` to lint the code.
- Testing: Run `deno test --allow-net --allow-env --allow-read --allow-write` to execute tests.

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