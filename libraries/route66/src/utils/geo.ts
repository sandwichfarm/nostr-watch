import { IEvent } from "@models/Event"
import { GeoCodesObjectRaw, ISO3166Type } from "@base/interfaces/TISO13166"

export const extractGeoCodesByType = ( event: IEvent, type: ISO3166Type ): (string | number)[] => {
  return event.tags
          .filter((tag: string[]) => tag[0] === 'l' && tag[2] === type)
          .map((tag: string[]) => tag[1])
          .filter((tag: string) => tag !== undefined) || []
}

export const extractGeoCodes = ( event: IEvent ): GeoCodesObjectRaw => {
  let countryCode: (string | number)[] = [];
  let regionCode: (string | number)[] = [];

  countryCode = extractGeoCodesByType(event, ISO3166Type.CountryCode)
  regionCode = extractGeoCodesByType(event, ISO3166Type.RegionCode)

  return { countryCode, regionCode } as GeoCodesObjectRaw
}