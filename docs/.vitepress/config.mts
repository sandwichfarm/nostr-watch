import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'nostr-watch',
  description: 'Documentation for the @nostrwatch monorepo',
  srcDir: '..',
  outDir: '.vitepress/dist',

  rewrites: {
    'libraries/:pkg/README.md': 'libraries/:pkg/index.md',
    'apps/:pkg/README.md': 'apps/:pkg/index.md',
    'internal/:pkg/README.md': 'internal/:pkg/index.md',
    'docs/:path(.*)': ':path',
  },

  ignoreDeadLinks: [
    /\/LICENSE$/,
    /\.planning\//,
    /\/adapters\//,
    /localhost/,
    /\/DEPLOYMENT$/,
    /\/MONITORING$/,
    /\/test-strategy$/,
    /\/src\/rest\/README$/,
  ],

  srcExclude: [
    '.planning/**',
    'node_modules/**',
    '**/node_modules/**',
    'scripts/**',
    '.ansible/**',
    '.changeset/**',
    '.github/**',
    'tests/**',
    '**/CHANGELOG.md',
    '**/dist/**',
    'demos/**',
    'vendor/**',
    'docs/gui/**',
  ],

  themeConfig: {
    search: { provider: 'local' },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Packages', link: '/packages/' },
    ],

    sidebar: {
      '/apps/': [
        {
          text: 'Apps',
          items: [
            { text: 'docker-stacks', link: '/apps/docker-stacks/' },
            { text: 'gui', link: '/apps/gui/' },
            { text: 'nocapd', link: '/apps/nocapd/' },
            { text: 'purist', link: '/apps/purist/' },
            { text: 'relaymon', link: '/apps/relaymon/' },
            { text: 'rstate', link: '/apps/rstate/' },
            { text: 'trawler', link: '/apps/trawler/' },
            { text: 'umon', link: '/apps/umon/' },
          ],
        },
      ],
      '/libraries/': [
        {
          text: 'Libraries',
          items: [
            { text: 'auditor', link: '/libraries/auditor/' },
            { text: 'db', link: '/libraries/db/' },
            { text: 'idb', link: '/libraries/idb/' },
            { text: 'kit', link: '/libraries/kit/' },
            { text: 'memory-relay', link: '/libraries/memory-relay/' },
            { text: 'negentropy', link: '/libraries/negentropy/' },
            { text: 'nip66', link: '/libraries/nip66/' },
            { text: 'nocap', link: '/libraries/nocap/' },
            { text: 'nocap-route66', link: '/libraries/nocap-route66/' },
            { text: 'nostrawl', link: '/libraries/nostrawl/' },
            { text: 'nostrings', link: '/libraries/nostrings/' },
            { text: 'relay-charts', link: '/libraries/relay-charts/' },
            { text: 'relay-chronicle', link: '/libraries/relay-chronicle/' },
            { text: 'route66', link: '/libraries/route66/' },
            { text: 'sanitize', link: '/libraries/sanitize/' },
            { text: 'schemata', link: '/libraries/schemata/' },
            { text: 'schemata-js-ajv', link: '/libraries/schemata-js-ajv/' },
            { text: 'transform', link: '/libraries/transform/' },
            { text: 'uptime-kuma-monitor', link: '/libraries/uptime-kuma-monitor/' },
            { text: 'websocket', link: '/libraries/websocket/' },
            { text: 'worker-relay', link: '/libraries/worker-relay/' },
          ],
        },
      ],
      '/internal/': [
        {
          text: 'Internal',
          items: [
            { text: 'announce', link: '/internal/announce/' },
            { text: 'controlflow', link: '/internal/controlflow/' },
            { text: 'kinds', link: '/internal/kinds/' },
            { text: 'logger', link: '/internal/logger/' },
            { text: 'nwcache', link: '/internal/nwcache/' },
            { text: 'publisher', link: '/internal/publisher/' },
            { text: 'redis', link: '/internal/redis/' },
            { text: 'seed', link: '/internal/seed/' },
            { text: 'utils', link: '/internal/utils/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sandwichfarm/nostr-watch' },
    ],
  },
})
