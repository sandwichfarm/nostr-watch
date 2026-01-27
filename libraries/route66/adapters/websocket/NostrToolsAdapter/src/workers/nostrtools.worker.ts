/// <reference lib="webworker" />

import { NostrToolsWorker } from '../NostrToolsWorker';

import { IWorkerGlobalScope } from "@nostrwatch/route66/interfaces";
import { CacheWorker, ICacheAdapterWorker } from '@nostrwatch/route66/factoryWorker';

////console.log('initiating nostrtools.worker.ts') 

const $self = self as unknown as IWorkerGlobalScope

const worker: ICacheAdapterWorker = CacheWorker(NostrToolsWorker, $self)