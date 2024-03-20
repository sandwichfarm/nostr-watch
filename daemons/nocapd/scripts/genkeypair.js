/*this should only ever be used for testing!!!!*/
import { setEnvValue } from '@nostrwatch/utils'

import { generatePrivateKey, getPublicKey } from 'nostr-tools'

const PRIVATE_KEY = generatePrivateKey()
const PUBLIC_KEY = getPublicKey(PRIVATE_KEY)

setEnvValue('DAEMON_PUBKEY', PUBLIC_KEY)
setEnvValue('DAEMON_PRIVKEY', PRIVATE_KEY)