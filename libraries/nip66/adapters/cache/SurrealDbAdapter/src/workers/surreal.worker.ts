/// <reference lib="webworker" />

import { SurrealDbWorker } from '../SurrealDbWorker';

import { IWorkerGlobalScope } from "@nostrwatch/nip66/interfaces";
import { CacheWorker, ICacheAdapterWorker } from '@nostrwatch/nip66/factoryWorker';

const $self = self as unknown as IWorkerGlobalScope
const worker: ICacheAdapterWorker = CacheWorker(SurrealDbWorker, $self)