// import { Transform } from '../Transform';
// import ngeotags from 'nostr-geotags';

// export interface GeoData {
//   isp?: string;
//   as?: string;
//   asname?: string;
//   [key: string]: any;
// }

// /**
//  * Represents a specific kind of publisher with additional tagging capabilities.
//  */
// export class Kind10166 extends Transform {
//   constructor(pubkey: string) {
//     super(10166, pubkey);
//   }

//   /**
//    * Generates an event with tags based on provided data.
//    * @param {MonitorData} data The data to generate tags from.
//    * @returns {string[][]} The generated tags.
//    */
//   generateTags(data: MonitorData): string[][] {
//     let tags: string[][] = [];

//     tags = this.addFrequencyTags(tags, data);
//     tags = this.addKindsTags(tags, data);
//     tags = this.addCountsTags(tags, data);
//     tags = this.addChecksTags(tags, data);
//     tags = this.addTimeoutTags(tags, data);
//     tags = this.addGeoTags(tags, data.geo?.data);

//     return tags;
//   }

//   private addFrequencyTags(tags: string[][], data: MonitorData): string[][] {
//     if (data?.frequency) {
//       tags.push(['frequency', data.frequency]);
//     }
//     return tags;
//   }

//   private addKindsTags(tags: string[][], data: MonitorData): string[][] {
//     if (data?.kinds) {
//       data.kinds.map(kind => kind.toString()).forEach(kind => tags.push(['k', kind]));
//     }
//     return tags;
//   }

//   private addCountsTags(tags: string[][], data: MonitorData): string[][] {
//     if (data?.counts) {
//       data.counts.map(count => count.toString()).forEach(count => tags.push(['n', count]));
//     }
//     return tags;
//   }

//   private addChecksTags(tags: string[][], data: MonitorData): string[][] {
//     if (data?.checks) {
//       data.checks.map(check => check.toString()).forEach(check => tags.push(['c', check]));
//     }
//     return tags;
//   }

//   private addTimeoutTags(tags: string[][], data: MonitorData): string[][] {
//     if (data?.timeouts) {
//       Object.keys(data.timeouts || {}).forEach(key => {
//         tags.push(['timeout', key, data.timeouts[key].toString()]);
//       });
//     }
//     return tags;
//   }

//   private addGeoTags(tags: string[][], geoData?: GeoData[]): string[][] {
//     if (!geoData || !Array.isArray(geoData)) return tags;

//     let ispTags: string[][] = [];
//     let geoTags: string[][] = [];

//     geoData.forEach((geo) => {
//       ispTags = this.addGeoIspTags(ispTags, geo);
//       geoTags = this.addGeoLocationTags(geoTags, geo);
//     });

//     geoTags = [...this.removeLabels(geoTags), ...this.dedupLabels(geoTags)];
//     ispTags = this.dedupLabels(ispTags);
//     tags.push(...ispTags, ...geoTags);
//     return tags;
//   }

//   private addGeoIspTags(tags: string[][], geo: GeoData): string[][] {
//     const ispFields = [
//       { key: 'isp', label: 'host.isp' },
//       { key: 'as', label: 'host.as' },
//       { key: 'asname', label: 'host.asn' },
//     ];

//     ispFields.forEach(({ key, label }) => {
//       if (geo[key]) {
//         tags.push(['L', label]);
//         tags.push(['l', geo[key], label]);
//       }
//     });

//     return tags;
//   }

//   private addGeoLocationTags(tags: string[][], geo: GeoData): string[][] {
//     const gOpts = {
//       isoAsNamespace: false,
//       geohash: true,
//       gps: false,
//       countryCode: true,
//       countryName: true,
//       regionCode: true,
//     };
//     const geoTags = ngeotags(geo, gOpts) as string[][];
//     return [...tags, ...geoTags];
//   }
// }
