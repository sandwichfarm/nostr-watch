/// <reference lib="webworker" />

import { NostrSqliteWorker } from '../NostrSqliteWorker';

import { ISharedWorkerGlobalScope, IWorkerGlobalScope, } from "@nostrwatch/nip66/interfaces";
import { CacheWorker } from '@nostrwatch/nip66/factoryWorker';

////console.log(`NostrSqliteWorker: Shared Worker loaded.`)

const $self = self as unknown as IWorkerGlobalScope | ISharedWorkerGlobalScope;

CacheWorker(NostrSqliteWorker, $self)