/**
 * Event Signing Utility
 *
 * Re-exports shared key/signer utilities from @nostrwatch/utils
 * and provides local aliases for backward compatibility.
 */

export { nsecToHex as toHexKey, nsecToBytes, createSigner, type EventSigner } from '@nostrwatch/utils'
