export const suiteTests = {
  Nip77: () => import('src/nips/Nip77/tests/index.ts'),
  Nip65: () => import('src/nips/Nip65/tests/index.ts'),
  Nip50: () => import('src/nips/Nip50/tests/index.ts'),
  Nip42: () => import('src/nips/Nip42/tests/index.ts'),
  Nip22: () => import('src/nips/Nip22/tests/index.ts'),
  Nip11: () => import('src/nips/Nip11/tests/index.ts'),
  Nip09: () => import('src/nips/Nip09/tests/index.ts'),
  Nip02: () => import('src/nips/Nip02/tests/index.ts'),
  Nip01: () => import('src/nips/Nip01/tests/index.ts')
};
