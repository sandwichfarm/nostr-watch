/// <reference lib="webworker" />

import { NostrToolsSharedWorker } from '../NostrToolsSharedWorker';

import { ISharedWorkerGlobalScope } from "@nostrwatch/nip66/interfaces";
import { CacheSharedWorker } from '@nostrwatch/nip66/factoryWorker';

const $self = self as unknown as ISharedWorkerGlobalScope;

$self.onconnect = CacheSharedWorker(NostrToolsSharedWorker)