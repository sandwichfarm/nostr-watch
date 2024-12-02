export const formatRelayUrl = (inputUrl: string): string => {
    try {
      const url = new URL(inputUrl);
      const protocol = url.protocol.slice(0, -1); //remove trailing ':'
      const everythingElse = inputUrl.split('://')[1];
      return `${protocol}/${everythingElse}`;
    } catch (error) {
      throw new Error("Invalid URL");
    }
}