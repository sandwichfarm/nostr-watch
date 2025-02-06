import { page } from "$app/stores";
import { relays } from "$stores/relays";
import { get } from "svelte/store";

export const generateRelayPathFromUrl = (inputUrl: string): string | undefined => {
  try {
      const url = new URL(inputUrl);
      const protocol = url.protocol.slice(0, -1);
      const everythingElse = url.host + url.pathname;  // Correctly captures path and host
      return `${protocol}/${everythingElse}`.replace(/\/$/, ''); // Remove trailing slash safely
  } catch (error) {
      console.warn(`Failed to format relay url: ${inputUrl}`);
  }
}

export const findValidRelayPath = (path: string, validUrls: string[], protocol: string): string | undefined => {
  let segments = path.split("/").filter(Boolean);
  while (segments.length > 1) { // Ensure at least protocol + hostname remain
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
  if (!validPath) return undefined;

  const validPathNoProtocol = validPath.replace(/^[^/]+\//, ''); // Removes protocol prefix safely
  const url = new URL(`${protocol}://${validPathNoProtocol}`).toString();
  return url;
};
