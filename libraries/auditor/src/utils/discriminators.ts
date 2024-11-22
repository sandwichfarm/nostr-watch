export const isNaturalLanguage = (text: string): boolean => {
  if (text.length < 3) return false;

  const lettersPattern = /[a-zA-Z]/;
  const nonAlphabeticPattern = /^[^a-zA-Z]+$/;
  const excessiveSymbolPattern = /[^a-zA-Z\s.,!?;:'"()-]/; 

  return lettersPattern.test(text) &&
         !nonAlphabeticPattern.test(text) &&
         (text.match(excessiveSymbolPattern)?.length ?? 0) < (text.length * 0.2);
}