import { Filter } from "nostr-tools";

export const searchRelayFilter = (): Filter => {
    return { "#N": [ "50" ] }
}

export const communityFilter = (): Filter => {
    return { "#N": [ "29" ] }
}