export const enum ISO3166Type {
  CountryCode = 'countryCode',
  RegionCode = 'regionCode',
}

export const enum ISO3166Format {
  Alpha = 'alpha',
  Numeric = 'numeric',
}

export type RawGeoCode = (string | number)
export type RawGeoCodes = RawGeoCode[]
export type GeoCodesObjectRaw = {
  countryCode: RawGeoCodes;
  regionCode:  RawGeoCodes;
}

