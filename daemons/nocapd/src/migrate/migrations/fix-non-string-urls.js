function findDuplicates(urls) {
  const normalizedUrls = [];
  const originalToNormalized = {};

  urls.forEach(url => {
    try {
      const normalizedUrl = new URL(url).toString();
      normalizedUrls.push(normalizedUrl);
      originalToNormalized[url] = normalizedUrl;
    } catch (error) {
      console.error(`Invalid URL skipped: ${url}`);
    }
  });

  const uniqueNormalizedUrls = Array.from(new Set(normalizedUrls));

  const duplicates = [];
  const nonDuplicates = [];

  urls.forEach(url => {
    const normalizedUrl = originalToNormalized[url];
    if (uniqueNormalizedUrls.includes(normalizedUrl) && url !== normalizedUrl) {
      duplicates.push(url);
    } else if (!uniqueNormalizedUrls.includes(normalizedUrl)) {
      nonDuplicates.push(url);
    }
  });

  return { normalizedUrls: uniqueNormalizedUrls, duplicates, nonDuplicates };
}

export const MigrationFixRelayDuplicates = async (rcache) => {
  const allRelays = await rcache.relay.get.all()
  for (const relay of allRelays){
    if(typeof relay.url === 'object'){
      if(relay.url?.url){
        await rcache.relay.patch({ url: relay.url.url })
      }
    }
  }
}