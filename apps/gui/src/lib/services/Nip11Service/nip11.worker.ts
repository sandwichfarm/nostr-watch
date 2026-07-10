import type { Nip11ServiceMessage } from "./index.js";
import { fetchRelayInformation, serializeNip11FetchError } from "./fetch-relay-information";

type Nip11WorkerRequest = {
    relay: string;
    timeoutMs?: number;
};

self.onmessage = ({ data }: MessageEvent<Nip11WorkerRequest>) => {
    const { relay, timeoutMs } = data;
    // console.log('N11S worker received message', data)
    fetchRelayInformation(relay, { timeoutMs })
        .then((nip11) => {
            self.postMessage({ relay, nip11 } as Nip11ServiceMessage)
        })
        .catch((error: unknown) => {
            self.postMessage({ relay, error: serializeNip11FetchError(error) } as Nip11ServiceMessage)
        })
}

self.onerror = () => {
    self.postMessage({
        error: { code: 'fetch-failed', message: 'NIP-11 worker failed.' }
    } as Nip11ServiceMessage)
}
