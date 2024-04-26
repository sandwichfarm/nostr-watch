export class ParseEvent {
  constructor() {
    this.name = 'parse';
  }

  getName() {
    return this.name;
  }

  groupedKeys(event) {
    const parsedTags = {};
    const url = getUrlFromEvent(event);
    if (!url) return { error: "no d tag?" };
    const tags = event.tags.filter((tag) => tag.length >= 3);
    tags.forEach((tag) => {
      const [key, subkey, ...values] = tag;
      if (!parsedTags[key]) {
        parsedTags[key] = {};
      }
      if (!parsedTags[key][subkey]) {
        parsedTags[key][subkey] =
          values.length > 1
            ? values.map((v) => castValue(v))
            : castValue(values[0]);
      } else {
        if (Array.isArray(parsedTags[key][subkey])) {
          parsedTags[key][subkey] = [
            ...parsedTags[key][subkey],
            ...values.map((v) => castValue(v)),
          ];
        } else {
          parsedTags[key][subkey] = [
            parsedTags[key][subkey],
            ...values.map((v) => castValue(v)),
          ];
        }
      }
    });
    if (!parsedTags?.rtt?.open)
      return { error: "no rtt connect tag?", tags: tags };
    return { url, ...parsedTags };
  }

  _cast(value){
    // Check for boolean strings
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Check for IPv4 addresses or similar patterns that should not be converted
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipv4Regex.test(value)) return value;

    // Additional check for geohash-like patterns (alphanumeric strings)
    // This regex matches strings that contain both letters and numbers, indicative of a geohash
    const geohashRegex = /^[0-9a-zA-Z]+$/;
    if (
      geohashRegex.test(value) &&
      /[a-zA-Z]/.test(value) &&
      /[0-9]/.test(value)
    )
      return value;

    // Attempt to parse as a float
    const asFloat = parseFloat(value);
    if (!isNaN(asFloat) && isFinite(asFloat) && String(asFloat) === value) {
      return asFloat;
    }

    // Return the original value if none of the above conditions are met
    return value;
  }
}