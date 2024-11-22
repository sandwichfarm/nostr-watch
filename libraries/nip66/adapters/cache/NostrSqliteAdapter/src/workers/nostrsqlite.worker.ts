/// <reference lib="webworker" />

import { NostrSqliteWorker } from '../NostrSqliteWorker';

import { IWorkerGlobalScope } from "@nostrwatch/nip66/interfaces";
import { CacheWorker, ICacheAdapterWorker } from '@nostrwatch/nip66/factoryWorker';

const $self = self as unknown as IWorkerGlobalScope

// console.log(`NostrSqliteWorker: Worker loaded.`)

const worker: ICacheAdapterWorker = CacheWorker(NostrSqliteWorker, $self)