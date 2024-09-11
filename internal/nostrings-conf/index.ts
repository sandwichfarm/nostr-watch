import type { Mutator, Discriminator, Modifier } from "@nostrwatch/nostrings"

import { groupUrlsByHostname } from "./utils"

const hostnameModifier: Discriminator = (relays: string[]): boolean => {
  const urlMap = groupUrlsByHostname(relays)

  for (const [hostname, urls] of urlMap) {
    if (urls.length > 1) {
      if(hostname.includes('localhost')) {
        return true
      }
    }
  }
}