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