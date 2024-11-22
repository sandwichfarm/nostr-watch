
export class Debounce<T = void> {
    private timer: ReturnType<typeof setTimeout> | null = null;
  
    /**
     * Executes the provided callback after the debounce time.
     * If called again within the debounce time, it resets the timer.
     * @param value - Optional value to pass to the callback.
     * @param time - Debounce time in milliseconds.
     * @param callback - Function to execute after the debounce delay.
     */
    execute(value: T, time: number = 750, callback: (value: T) => void): void {
      // Clear the existing timer
      if (this.timer) {
        clearTimeout(this.timer);
      }
  
      // Set a new timer
      this.timer = setTimeout(() => {
        callback(value);
        this.timer = null; // Clear timer reference after execution
      }, time);
    }
  
    /**
     * Cancels the debounce timer if it's active.
     */
    cancel(): void {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }
  