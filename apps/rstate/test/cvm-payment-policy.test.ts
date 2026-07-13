import { describe, expect, it } from 'vitest'
import { resolveCvmPaymentInteractionPolicy } from '../src/payments/cvm-payment-policy.js'

describe('CVM payment interaction policy', () => {
  it('defaults to the ContextVM 0.13 optional lifecycle policy', () => {
    expect(resolveCvmPaymentInteractionPolicy({})).toBe('optional')
  })

  it('accepts transparent-only compatibility mode', () => {
    expect(resolveCvmPaymentInteractionPolicy({ CVM_PAYMENT_INTERACTION_POLICY: 'transparent' })).toBe('transparent')
  })

  it('accepts the explicit optional policy value', () => {
    expect(resolveCvmPaymentInteractionPolicy({ CVM_PAYMENT_INTERACTION_POLICY: ' optional ' })).toBe('optional')
  })

  it('rejects wire-level payment interaction modes as server policy values', () => {
    expect(() => resolveCvmPaymentInteractionPolicy({
      CVM_PAYMENT_INTERACTION_POLICY: 'explicit_gating',
    })).toThrow('CVM_PAYMENT_INTERACTION_POLICY must be "optional" or "transparent"')
  })
})
