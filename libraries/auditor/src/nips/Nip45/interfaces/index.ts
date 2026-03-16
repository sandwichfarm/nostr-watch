export type RelayCountMessage = [
  'COUNT',
  string,
  {'count': number; 'approximate'?: boolean; 'hll'?: string}
]
