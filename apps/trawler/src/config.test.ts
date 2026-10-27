import { assertEquals } from 'https://deno.land/std@0.218.2/assert/mod.ts';
import { loadConfig } from './config.ts';

Deno.test('loads FIPS seed configuration from YAML', async () => {
  const path = await Deno.makeTempFile({ suffix: '.yaml' });
  const previous = Deno.env.get('TRAWLER_CONFIG_PATH');
  try {
    await Deno.writeTextFile(path, 'trawler:\n  seed:\n    options:\n      allowedNetworks: [clearnet, fips]\n');
    Deno.env.set('TRAWLER_CONFIG_PATH', path);
    assertEquals((await loadConfig()).trawler.seed.options.allowedNetworks, ['clearnet', 'fips']);
  } finally {
    if (previous === undefined) Deno.env.delete('TRAWLER_CONFIG_PATH');
    else Deno.env.set('TRAWLER_CONFIG_PATH', previous);
    await Deno.remove(path);
  }
});
