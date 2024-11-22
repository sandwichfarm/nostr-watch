
type SoftwareMap = Map<string, string>;

function excludeStupidity(items: string[]): string[] {
    return items.filter((item) => {
        return !item.includes(' ');
    });
}

export function makeReadableSoftwareMap(items: string[]): SoftwareMap {
    const repoMap: SoftwareMap = new Map();
    items.forEach((item) => {
       repoMap.set(item, makeSoftwareReadable(item));
    });
    return repoMap;
}

export function makeSoftwareReadable(item: string): string {
    let urlString = item;
    if(item.includes(' ')){
        return "eats/ass"
    }
    if (urlString.startsWith('git+')) {
        urlString = urlString.slice(4);
    }
    try {
        const url = new URL(urlString);

        const hostname = url.hostname.toLowerCase();
        let platform: 'github' | 'gitlab' | null = null;

        if (hostname.includes('git')) {
            platform = 'github';
        } else {
            return item;
        }

        const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

        if (pathSegments.length < 2) {
            return item;
        }

        const username = pathSegments[0];
        let repo = pathSegments[1];

        if (repo.endsWith('.git')) {
            repo = repo.slice(0, -4);
        }

        const mappedValue = `${username}/${repo}`;
        return mappedValue
    } catch (e) {
        return item;
    }
}


// export default (software: string): string => {
//    return makeReadable(software);   
// }
