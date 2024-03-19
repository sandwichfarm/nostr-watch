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
  const allRelays = await rcache.relay.get.all(['url']).map( relay => relay.url )
  const dupes = findDuplicates(allRelays).duplicates 
  if(dupes.length === 0) return console.log(`Migrate: MigrationFixRelayDuplicates: no duplicates found`)
  console.log(`deleting ${dupes.length} duplicates`)
  let deleted = 0
  for (const dupe of dupes){
    const id = await rcache.relay.delete(dupe)
    console.log(`deleted: ${dupe} [${id}]`)
    deleted++
  }
  console.log(`deleted ${deleted} duplicates`)  
}