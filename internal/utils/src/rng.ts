function sfc32(a: number, b: number, c: number, d: number): Function {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

const seedgen = (): number => (Math.random()*2**32)>>>0;
export const rand = sfc32(seedgen(), seedgen(), seedgen(), seedgen());


export const randomNumeric = (length: number = 32) => {
  const characters = '0123456789';
  return _random(length, characters);
}

export const randomAlphaNumeric = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return _random(length, characters);
}

export const randomAlpha = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return _random(length, characters);
}

export const randomLowerAlpha = (length: number = 32) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  return _random(length, characters);
}

export const randomUpperAlpha = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return _random(length, characters);
}

export const randomHex = (length: number = 32) => {
  const characters = '0123456789abcdef';
  return _random(length, characters);
}

export const randomBase64 = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  return _random(length, characters);
}

export const randomUrlSafe = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return _random(length, characters);
}

export const randomAlphaNumericSymbol = (length: number = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  return _random(length, characters);
}

const _random = (length: number, characters: string) => { 
  let result = '';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(rand() * charactersLength));
    counter += 1;
  }
  return result;
}
