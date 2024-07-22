export const enum ISO3166Type {
  CountryCode = 'countryCode',
  RegionCode = 'regionCode',
}

export const enum ISO3166Format {
  Alpha = 'alpha',
  Numeric = 'numeric',
}

export type GeoCodesRaw = {
  countryCode?: string | string[]
  regionCode?: string | string[];
}