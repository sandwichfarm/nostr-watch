export const suiteTests = {
  Nip77: () => import('src/nips/Nip77/tests/index.ts'),
  Nip50: () => import('src/nips/Nip50/tests/index.ts'),
  Nip11: () => import('src/nips/Nip11/tests/index.ts'),
  Nip01: () => import('src/nips/Nip01/tests/index.ts')
};
