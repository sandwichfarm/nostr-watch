```
Note: This package will be migrated to nostrability/schemata once all events that @nostrwatch tests have a schema specified.
```

# @nostrwatch/schemata

A template for simplifying the validation of nostr events, their attributes and their respective tags using JSON-Schema standards. 

## Related
- [`@nostrwatch/schemata-js-ajv`](https://github.com/sandwichfarm/nostr-watch/tree/next/libraries/schemata-js-ajv) - Typescript library for validating nostr events, depends on this package.

## Usage 
1. Download ZIP file (all languages) or include package (js only for now)
2. Validate `.json` schemas against nostr events. 

## Use in your own pipline 
You shouldn't. You should write a wrapper or use one that already exists. Wrappers **must** use the following typings.
```
type NSchemaResult [ boolean, NSchemaMessage[] ]
interface NSchemaMessage {
    level: "info" | "warning" | "error" 
    message: string
} 
```

And provide the following interface: 
```
validate(event: NostrEvent): NSchemaResult
validateMany(events: NostrEvent[]): NSchemaResult[]
```

## Contribute

### Setup 
1. Fork the repo.
2. `npm/yarn/pnpm install` 
3. `npm/yarn/pnpm build`
4. `npm/yarn/pnpm test`

## Writing Schemas
Familiarize yourself with the aliases section and the file structure.
1. Create a new directory for your NIP, and a directory for each kind.
...this is going to be annoying to write, so it should probbaly be automated. 

## FS Conventions
This toolkit uses path conventions for build and testing schemata. 

`nips/nip-XY/kind-N/schema.yaml` 

Kinds are assumed to belong to a NIP, but if you are working with an experimental kind, you won't have a NIP. For these situations, simply place the kind into a nipless "nipless" 

`nips/nipless/kind-X`
