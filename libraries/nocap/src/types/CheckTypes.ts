export type StrictCheckKey = 'open' | 'read' | 'write' | 'ssl' | 'dns' | 'geo' | 'info'
export type CheckKey = 'all' | StrictCheckKey
export type CheckKeySynonyms = 'nip11' | 'ws' | 'websocket' | 'tls'

export type CheckMethodKey = `check_${CheckKey}`;
export type PreCheckKey = `precheck_${CheckKey}`;
export type DurationCheckKey = `${CheckKey}_duration`;