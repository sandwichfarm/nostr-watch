import { writable, type Writable } from "svelte/store";
import { isProduction } from "./env";

export const theme: Writable<string> = writable(isProduction() ? "dark" : "system");
export const darkMode: Writable<boolean> = writable(isProduction());

// In production, always set darkMode to true
// In development, respect the system preference or user choice
if (isProduction()) {
  darkMode.set(true);
  // Ensure dark class is applied
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }
} else {
  // Only in development, check if dark class is present
  if (typeof document !== 'undefined') {
    document.documentElement.classList.contains("dark") && darkMode.set(true);
  }
}

// Observe class changes only in development mode
if (!isProduction() && typeof document !== 'undefined' && typeof window !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === "class") {
        const classList = document.documentElement.classList;
        darkMode.set(classList.contains("dark"));
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}