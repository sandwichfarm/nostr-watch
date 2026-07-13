import type { PaymentInteractionPolicy } from '@contextvm/sdk'

const DEFAULT_CVM_PAYMENT_INTERACTION_POLICY: PaymentInteractionPolicy = 'optional'

export function resolveCvmPaymentInteractionPolicy(
  env: { [key: string]: string | undefined } = process.env
): PaymentInteractionPolicy {
  const rawPolicy = env.CVM_PAYMENT_INTERACTION_POLICY?.trim()

  if (!rawPolicy) return DEFAULT_CVM_PAYMENT_INTERACTION_POLICY
  if (rawPolicy === 'optional' || rawPolicy === 'transparent') return rawPolicy

  throw new Error(
    `CVM_PAYMENT_INTERACTION_POLICY must be "optional" or "transparent"; got "${rawPolicy}"`
  )
}
