type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Retrieves the inheritance chain of a given class constructor.
 * @param cls - The class constructor to inspect.
 * @returns An array of class constructors representing the inheritance chain.
 */
export const getInheritanceChain = (cls: Constructor): Function[] => {
  const chain: Function[] = [];
  let currentProto = Object.getPrototypeOf(cls.prototype);

  while (currentProto && currentProto.constructor !== Object) {
    chain.push(currentProto.constructor);
    currentProto = Object.getPrototypeOf(currentProto);
  }

  // Optionally include Object
  if (currentProto && currentProto.constructor === Object) {
    chain.push(Object);
  }
  
  return chain;
};

/**
 * Retrieves the inheritance chain as an array of class names.
 * @param cls - The class constructor to inspect.
 * @returns An array of class names representing the inheritance chain.
 */
export const getInheritanceChainArray = <T>(cls: Constructor<T>): string[] => {
  return getInheritanceChain(cls).map(constructor => constructor.name);
};

/**
 * Retrieves the inheritance chain from an instance.
 * @param instance - The class instance to inspect.
 * @returns An array of class names representing the inheritance chain.
 */
export const getInheritanceChainFromInstance = <T extends object>(instance: T): string[] => {
  const constructor = instance.constructor as Constructor<T>;
  return getInheritanceChainArray(constructor);
};