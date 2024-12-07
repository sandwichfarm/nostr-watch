export const isPubkey = (value: string): boolean => {
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    return hexRegex.test(value);
}
