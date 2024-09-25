/// <reference lib="webworker" />

import { DexieSharedWorker } from '../DexieSharedWorker';

import { ISharedWorkerGlobalScope } from "@nostrwatch/nip66/interfaces";
import CacheSharedWorkerFactory from '@nostrwatch/nip66/cacheSharedWorkerFactory';

const $self = this as unknown as ISharedWorkerGlobalScope;

$self.onconnect = CacheSharedWorkerFactory(DexieSharedWorker)