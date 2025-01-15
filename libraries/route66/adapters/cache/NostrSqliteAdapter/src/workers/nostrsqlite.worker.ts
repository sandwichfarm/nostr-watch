/// <reference lib="webworker" />

import { NostrSqliteWorker } from '../NostrSqliteWorker';

import { ISharedWorkerGlobalScope, IWorkerGlobalScope, } from "@nostrwatch/route66/interfaces";
import { CacheWorker } from '@nostrwatch/route66/factoryWorker';

////console.log(`NostrSqliteWorker: Shared Worker loaded.`)

const $self = self as unknown as IWorkerGlobalScope | ISharedWorkerGlobalScope;

CacheWorker(NostrSqliteWorker, $self)