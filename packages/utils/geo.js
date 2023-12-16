const ngeohash = require('ngeohash');
const iso3166 = require('iso-3166');

export const transformData = (input) => {
    const transformedData = [];

    // Geohash
    if (input.lat && input.lon) {
        const geohash = ngeohash.encode(input.lat, input.lon);
        transformedData.push([geohash, 'geohash']);
    }

    // City
    if (input.city) {
        transformedData.push([input.city, 'city']);
    }

    // ISO-3166-2 (region code)
    if (input.country && input.region) {
        const iso3166Data = iso3166.country(input.country);
        if (iso3166Data && iso3166Data.regions) {
            const regionCode = iso3166Data.regions.find(r => r.name === input.regionName)?.code;
            if (regionCode) {
                transformedData.push([regionCode, 'ISO-3166-2']);
            }
        }
    }

    // ISO-3166-1 Alpha-2 (country code)
    if (input.countryCode) {
        transformedData.push([input.countryCode, 'ISO-3166-1:Alpha-2']);
    }

    // Continent
    if (input.continent) {
        transformedData.push([input.continent, 'continent']);
    }

    // Planet - Assuming Earth as there's no specific data for planet
    transformedData.push(['Earth', 'planet']);

    return transformedData;
}
