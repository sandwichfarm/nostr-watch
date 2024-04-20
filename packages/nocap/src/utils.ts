/**
 * Generates a random string of a specified length using alphanumeric characters.
 * @param length The desired length of the random string.
 * @returns A random string composed of uppercase and lowercase letters and digits.
 */
export const random = (length: number): string => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}