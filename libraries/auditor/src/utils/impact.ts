export type ImpactLevel = 'read' | 'low-write' | 'write'

export type StressLevel = 'normal' | 'stress'

export const IMPACT_ORDER: readonly ImpactLevel[] = ['read', 'low-write', 'write'] as const

export function impactAllowed(testImpact: ImpactLevel, maxImpact: ImpactLevel): boolean {
  return IMPACT_ORDER.indexOf(testImpact) <= IMPACT_ORDER.indexOf(maxImpact)
}
