import { page } from "$app/stores";
import { relays } from "$stores/relays";
import { get } from "svelte/store";

export const generateRelayPathFromUrl = (inputUrl: string): string | undefined => {
    try {
      const url = new URL(inputUrl);
      const protocol = url.protocol.slice(0, -1);
      const everythingElse = inputUrl.split('://')[1];
      return `${protocol}/${everythingElse}`.slice(0, -1);
    } catch (error) {
      console.warn(`Failed to format relay url: ${inputUrl}`);
    }
}

export const findValidRelayPath = (path: string, validUrls: string[], protocol: string): string | undefined => {
  let segments = path.split("/").filter(Boolean); 
  while (segments.length > 0) {
      const currentPath = "/" + segments.join("/");
      const relayUrl = new URL(`${protocol}://${currentPath}`).toString();
      if (validUrls.includes(relayUrl)) {
          return generateRelayPathFromUrl(relayUrl);
      }
      segments.pop();
  }
  return undefined;
};

export const generateRelayUrlFromPath = (inputPath: string = get(page).params.relay): string | undefined => {
  const protocol = get(page).params.protocol;
  const validPath = findValidRelayPath(inputPath, get(relays), protocol) || inputPath;
  const validPathNoProtocol = validPath.split('/')[1];  
  if (!validPath) return undefined;
  const url = new URL(`${protocol}://${validPathNoProtocol}`).toString();
  return url
};
