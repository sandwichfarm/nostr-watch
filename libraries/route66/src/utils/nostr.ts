export const isPubkey = (value: string): boolean => {
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    return hexRegex.test(value);
}

export type WebsocketUrlType = `wss://${string}` | `ws://${string}`;
export const getNormalizedWebsocketVariants = (url: WebsocketUrlType): [WebsocketUrlType, WebsocketUrlType] => {
    const withoutSlash = url.replace(/\/+$/, '') as WebsocketUrlType;
    const withSlash = withoutSlash + '/' as WebsocketUrlType;
    return [withoutSlash, withSlash];
}