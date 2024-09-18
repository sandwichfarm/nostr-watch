export const modelDefaults = <T>(): { [K in keyof T]: T[K] | null } => {
  const defaultObject = {} as { [K in keyof T]: T[K] | null };
  Object.keys(defaultObject).forEach(key => {
    defaultObject[key as keyof T] = null as any;
  });
  return defaultObject;
}