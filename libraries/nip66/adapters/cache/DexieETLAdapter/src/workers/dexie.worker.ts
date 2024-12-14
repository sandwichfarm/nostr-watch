/// <reference lib="webworker" />

import { DexieWorker } from '../DexieWorker';

import { IWorkerGlobalScope } from "@nostrwatch/nip66/interfaces";
import { CacheWorker, ICacheAdapterWorker } from '@nostrwatch/nip66/factoryWorker';

////console.log('initiating dexie.worker.ts') 

const $self = self as unknown as IWorkerGlobalScope

const worker: ICacheAdapterWorker = CacheWorker(DexieWorker, $self)