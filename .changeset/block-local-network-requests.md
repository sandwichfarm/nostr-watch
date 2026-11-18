---
"@nostrwatch/utils": minor
"@nostrwatch/route66-wsadapter-nostrtools": patch
---

Add `isLocalNetworkHost` and `isLocalNetworkUrl` to `@nostrwatch/utils`. The nostr-tools websocket worker now drops relay URLs that target loopback or private network addresses before connecting, publishing or closing.
