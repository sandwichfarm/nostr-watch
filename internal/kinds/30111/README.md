# Virtual Directory 

A Virtual Directory is a `NIP-51` pattern for producing semi-static, logically ordered, paginated `NIP-51` lists.

## Kind 

All Virtual Directories are published to kind `3????` _[30111 maybe?]_ but utilize a patternn composed of one of three types

### Types

- `directory of directories` - This can be seen as the root directory. 
- `directory of pages` - This is a paginated directory. If a single publisher of these indexes published to two different relays with different limitations, the events may be different on each relay. Thus, pulling page types 
- `page of lists` - This can be seen as the root directory. 

Types are identified via a `type` event tag and have different limitations. 

### Pathing 
Paths for Virtual Directories are set via the `d` tag. Here are some examples 

```
/relays
/relays/online
/relays/online/1
```

In the above example, `/relays` is a directory of directories, `/relays/online` is a directory of pages, and `/relays/online/1` is a page of lists.



#### Directory of Directories

Not all Virtual Directory 

##### Limitations 
- An index of indexes **must** use `a` tags and include a relay where the event can be found. This is because the number of pages found at each of it's list items could differ due to a relay's `max_tags` limitation. 
- 

{
  "id": "567b41fc9060c758c4216fe5f8d3df7c57daad7ae757fa4606f0c39d4dd220ef",
  "pubkey": "d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c",
  "created_at": 1695327657,
  "kind": 30033,
  "tags": [
    ["d", "/relays"],
    ["description", "An index of indexes"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|online", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|paid", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|public", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|dead", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|valid", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|clearnet|known", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|tor|...", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|i2p|...", "wss://"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|index|cjdns|...", "wss://"],
    ["a", "..."],
    ["expiration", "1600000000"]
  ],
  "content": "",
  "sig": "a9a4e2192eede77e6c9d24ddfab95ba3ff7c03fbd07ad011fff245abea431fb4d3787c2d04aad001cb039cb8de91d83ce30e9a94f82ac3c5a2372aa1294a96bd"
}

## Index of Pages
{
  "id": "567b41fc9060c758c4216fe5f8d3df7c57daad7ae757fa4606f0c39d4dd220ef",
  "pubkey": "d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c",
  "created_at": 1695327657,
  "kind": 30033,
  "tags": [
    ["d", "/relays/online"],
    ["description", "An index of online relay lists updated periodically"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|clearnet|online|page1"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|clearnet|online|page2"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|clearnet|online|page3"],
    ["a", "30033:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:relays|clearnet|online|page4"],
    ["expiration", "1600000000"]
  ],
  "content": "",
  "sig": "a9a4e2192eede77e6c9d24ddfab95ba3ff7c03fbd07ad011fff245abea431fb4d3787c2d04aad001cb039cb8de91d83ce30e9a94f82ac3c5a2372aa1294a96bd"
}

## Page of Lists
{
  "id": "d78ba0d5dce22bfff9db0a9e996c9ef27e2c91051de0c4e1da340e0326b4941e",
  "pubkey": "d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c",
  "created_at": 1695327657,
  "kind": 30033,
  "tags": [
    ["d", "/relays/online/1"],
    ["description", ""],
    ["r", "wss://a.relay"],
    ["a", "30303:d6dc95542e18b8b7aec2f14610f55c335abebec76f3db9e58c254661d0593a0c:wss://a.relay", "wss://"],
    ["expiration", "1600000000"]
  ],
  "content": "",
  "sig": "a9a4e2192eede77e6c9d24ddfab95ba3ff7c03fbd07ad011fff245abea431fb4d3787c2d04aad001cb039cb8de91d83ce30e9a94f82ac3c5a2372aa1294a96bd"
}
