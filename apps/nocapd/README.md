# nocapd 
> nocapd is alpha, config and env format will change. Migrations could be breaking. Not suggested for the faint of heart.

deamon that monitors nostr relays discovered by `trawler`. s

# config 
```yaml
publisher: 
  to_relays: #which relays to publish NIP-66 events to.
    - 'wss://history.nostr.watch'

nocapd: 
  loglevel: info 

  networks:  #which networks to monitor
    - clearnet

  retry: 
    expiry: [ #backoff
      { max: 3, delay: 1000 * 60 * 60 * 1},
      { max: 4, delay: 1000 * 60 * 60 * 2},
      { max: 5, delay: 1000 * 60 * 60 * 3},
      { max: 20, delay: 1000 * 60 * 60 * 6 },
      { max: 50, delay: 1000 * 60 * 60 * 24 },
      { max: 54, delay: 1000 * 60 * 60 * 24 * 7 }
    ]

  seed: #where to find relays to check
    sources:
      - events 
    options:
        events:
          interval: 15m
          relays: 
            - 'wss://history.nostr.watch'
          pubkeys:
            - '6cd206fb5517a77497b53a4c64219fd8b5bce845231ecd271e74a96b03afdcda'
          
  checks: 
    enabled:
      - all
    options: 
      enabled: true 
      expires: 1h
      interval: 1m
      priority: 10
      timeout: {
        connect: 15000,
        read: 15000,
        write: 15000,
        dns: 3000,
        geo: 3000,
        info: 6000,
        ssl: 3000,
      }
      max: "Math.ceil(relays.length/60)"

  bullmq:
    worker: 
      concurrency: 1
```

# .env
```shell
NWCACHE_PATH="/path/to/lmdb.mdb" #the .mdb will be created if it doesn't exist on first boot, but the rest of the path does need to exist.

DAEMON_PUBKEY="" #nostr pubkey hex
DAEMON_PRIVKEY="" #nostr private key

# NOCAP: AdapterGeoDefault
IP_API_KEY="" #needed for AdapterGeoDefault in nocap

#REDIS
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=""
REDIS_LOGLEVEL="warning"
```

# boot
```shell
yarn launch
```