/// <reference lib="webworker" />

import CacheSharedWorkerFactory from '@base/factory/cache.shared.worker';
import { DexieSharedWorker } from '../DexieSharedWorker';
import { ISharedWorkerGlobalScope } from "@base/interfaces/ISharedWorkerGlobalScope";

const $self = this as unknown as ISharedWorkerGlobalScope;

$self.onconnect = CacheSharedWorkerFactory(DexieSharedWorker)