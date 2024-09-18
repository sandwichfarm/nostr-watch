export const isObject = (item: any): boolean => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

export const deepCopy = (obj: any): any => {
  if (isObject(obj)) {
    const copy: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      copy[key] = deepCopy(obj[key]);
    });
    return copy;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => deepCopy(item));
  }
  return obj;
};