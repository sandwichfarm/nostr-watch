# nostr-relay-registry

A dynamic registry of nostr relays that tests for very basic tasks in real-time.

## Docker

Build the docker image:

```bash
docker build -t nostr-relay-registry .
```

Run the container interactively:

```bash
docker run --rm -it --name=nostr-relay-registry -p 8080:80 nostr-relay-registry
```

Run container in the background:

```bash
docker run -d --restart unless-stopped --name nostr-relay-registry -p 8080:80 nostr-relay-registry
```
