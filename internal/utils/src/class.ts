export const isClassInstance = (value: any): boolean => {
  return value && typeof value === 'object' && value.constructor && value.constructor !== Object;
}
