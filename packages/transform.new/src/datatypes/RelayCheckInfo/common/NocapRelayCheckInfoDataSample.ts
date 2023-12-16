export default {
  url: 'wss://example.com',
  network: 'clearnet',
  adapters: ['InfoAdapterDefault'],
  checked_at: 1702054745791,
  checked_by: 'testUser',
  info: {
      status: 'success',
      data: {
          name: 'Example Relay',
          description: 'A test relay for example purposes.',
          pubkey: 'abcdef1234567890',
          contact: 'contact@example.com',
          supported_nips: [1, 2, 3, 4],
          retention: [
            { kinds: [1, 2], time: 72 }
          ],
          language_tags: ['en', 'es'],
          tags: ['tag1', 'tag2'],
          posting_policy: 'open',
          relay_countries: ['US', 'CA'],
          version: '1.0.0',
          limitation: {
            max_message_length: 1024,
            max_subscriptions: 50,
            max_filters: 25,
            max_limit: 100,
            max_subid_length: 32,
            min_prefix: 2,
            max_event_tags: 5,
            max_content_length: 2048,
            min_pow_difficulty: 0,
            auth_required: false,
            payment_required: true
          },
          payments_url: 'https://example.com/payments',
          fees: {
            admission: [{ amount: 1000, unit: 'msats', period: 30 }]
          }
      },
      duration: 123
    }
  };