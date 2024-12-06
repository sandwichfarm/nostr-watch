export const formatSeconds = (seconds: number): string => {
    if (seconds < 60) {
      return seconds === 1 ? '1 second' : `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      const days = Math.floor(seconds / 86400);
      return days === 1 ? '1 day' : `${days} days`;
    }
  }

  export const timeAgo = (timestamp: Date | number): string => {
    const now = new Date();
    const time = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const seconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  
    const intervals: { [key: string]: number } = {
      year: 60 * 60 * 24 * 365,
      month: 60 * 60 * 24 * 30,
      day: 60 * 60 * 24,
      hour: 60 * 60,
      minute: 60,
      second: 1,
    };
  
    for (const key in intervals) {
      const interval = Math.floor(seconds / intervals[key]);
      if (interval >= 1) {
        return `${interval} ${key}${interval > 1 ? 's' : ''} ago`;
      }
    }
  
    return 'just now';
  }  