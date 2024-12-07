import { nip11 } from "nostr-tools";
import type { Nip11ServiceMessage } from "./index.js";

const check = async (relay: string): Promise<nip11.RelayInformation> => {
    return nip11.fetchRelayInformation(relay)
}

self.onmessage = ({ data }) => {
    const { relay } = data;
    check(relay)
        .then((result: nip11.RelayInformation) => self.postMessage({relay, nip11: result} as Nip11ServiceMessage))
        .catch(console.error)
}