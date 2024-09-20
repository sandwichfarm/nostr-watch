/// <reference lib="webworker" />

import { DexieSharedWorker } from '../DexieSharedWorker';

import CacheSharedWorkerFactory from '@nostrwatch/nip66/factory/cache.shared.worker';
import { ISharedWorkerGlobalScope } from "@nostrwatch/nip66/interfaces/ISharedWorkerGlobalScope";

const $self = this as unknown as ISharedWorkerGlobalScope;

$self.onconnect = CacheSharedWorkerFactory(DexieSharedWorker)