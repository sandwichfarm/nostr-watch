// import brotli from "brotli"

// export const compressArray = async (data: object[]): Promise<Uint8Array>  => {
//     const jsonBuffer = Buffer.from(JSON.stringify(data));
//     const compressed = brotli.compress(jsonBuffer, {
//         mode: 0,
//         quality: 11,
//         lgwin: 22
//     });
//     if (!compressed) {
//         throw new Error('Compression failed');
//     }
//     return compressed;
// }

// export const decompressArray = async (compressed: Uint8Array): Promise<object[]> => {
//     const decompressed = brotli.decompress(compressed);
//     if (!decompressed) {
//         throw new Error('Decompression failed');
//     }
//     return JSON.parse(Buffer.from(decompressed).toString());
// }