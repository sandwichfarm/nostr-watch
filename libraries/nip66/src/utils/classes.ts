type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Retrieves the inheritance chain of a given class constructor.
 * @param cls - The class constructor to inspect.
 * @returns An array of class constructors representing the inheritance chain.
 */
export const getInheritanceChain = (cls: Constructor): Function[] => {
  const chain: Function[] = [];
  let currentProto = Object.getPrototypeOf(cls.prototype);

  // Traverse the inheritance chain
  while (currentProto && currentProto.constructor && currentProto.constructor !== Object) {
    const constructor = currentProto.constructor;

    // Only add valid class constructors (skip empty names or functions)
    if (constructor.name && constructor !== Function) {
      chain.push(constructor);
    }
    currentProto = Object.getPrototypeOf(currentProto);
  }

  // Add Object if necessary, to denote the end of the chain
  if (!chain.includes(Object)) {
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
  return getInheritanceChain(cls).map(constructor => constructor.name).filter(Boolean); // Filter out empty names
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
