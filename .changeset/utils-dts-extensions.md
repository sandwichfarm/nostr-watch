---
"@nostrwatch/utils": patch
---

Emit `.js` extensions on relative specifiers in the published declaration files (`dist/types`). The package is `"type": "module"`, so consumers resolving types with `moduleResolution: node16`/`nodenext` could not follow `export * from './network'` and saw no named exports (e.g. `isLocalNetworkUrl`). Sources and runtime bundles are unchanged.
