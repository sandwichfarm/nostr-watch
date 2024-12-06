import { nip11 } from "nostr-tools";

const check = async (relay: string): Promise<any> => {
    return nip11.fetchRelayInformation(relay)
}

self.onmessage = ({ data }) => {
    const { relay } = data;
    check(relay)
        .then((result: any) => self.postMessage({relay, nip11: result}))
        .catch(console.error)
}