
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

export function makeSoftwareReadable(urlString: string): string {
    if(!urlString) return urlString;
    if(urlString.includes(' ')){
        return "invalid software identifier"
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
            return urlString;
        }

        const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);

        if (pathSegments.length < 2) {
            return urlString;
        }

        const username = pathSegments[0];
        let repo = pathSegments[1];

        if (repo.endsWith('.git')) {
            repo = repo.slice(0, -4);
        }

        const mappedValue = `${username}/${repo}`;
        return mappedValue
    } catch (e) {
        return urlString;
    }
}


// export default (software: string): string => {
//    return makeReadable(software);   
// }
