export const getBrowserInfo = (): { name: string; version: string } => {
    const userAgent = navigator.userAgent;
    let browserName = 'unknown';
    let browserVersion = 'unknown';
    if (/opr\/|opera\//i.test(userAgent)) {
      browserName = 'opera';
      const match = userAgent.match(/(opera|opr)\/(\d+(\.\d+)?)/i);
      browserVersion = match && match[2] ? match[2] : 'unknown';
    } else if (/edg\//i.test(userAgent)) {
      browserName = 'edge';
      const match = userAgent.match(/edg\/(\d+(\.\d+)?)/i);
      browserVersion = match && match[1] ? match[1] : 'unknown';
    } else if (/chrome\//i.test(userAgent)) {
      browserName = 'chrome';
      const match = userAgent.match(/chrome\/(\d+(\.\d+)?)/i);
      browserVersion = match && match[1] ? match[1] : 'unknown';
    } else if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent) && !/opr\/|opera\//i.test(userAgent) && !/edg\//i.test(userAgent)) {
      browserName = 'safari';
      const match = userAgent.match(/version\/(\d+(\.\d+)?)/i);
      browserVersion = match && match[1] ? match[1] : 'unknown';
    } else if (/firefox\//i.test(userAgent)) {
      browserName = 'firefox';
      const match = userAgent.match(/firefox\/(\d+(\.\d+)?)/i);
      browserVersion = match && match[1] ? match[1] : 'unknown';
    } else if (/msie|trident\//i.test(userAgent)) {
      browserName = 'internet explorer';
      const match = userAgent.match(/(msie|rv:)(\d+(\.\d+)?)/i);
      browserVersion = match && match[2] ? match[2] : 'unknown';
    }
    const format = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    return {
      name: format(browserName),
      version: format(browserVersion)
    };
  }