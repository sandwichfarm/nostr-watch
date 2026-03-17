/**
 * Dark mode theme management using Svelte 5 runes.
 * File must be named .svelte.ts for rune compilation.
 */

export const theme = $state({ dark: false });

/**
 * Initialize theme from localStorage or system preference.
 * Call in onMount to avoid SSR issues.
 */
export function initTheme(): void {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      theme.dark = true;
    } else if (stored === 'light') {
      theme.dark = false;
    } else {
      // Fall back to system preference
      theme.dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme();
  } catch {
    // Ignore errors (e.g., in SSR or restricted environments)
  }
}

/**
 * Toggle between dark and light mode, persisting the preference.
 */
export function toggleTheme(): void {
  theme.dark = !theme.dark;
  try {
    localStorage.setItem('theme', theme.dark ? 'dark' : 'light');
  } catch {
    // Ignore storage errors
  }
  applyTheme();
}

function applyTheme(): void {
  if (theme.dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
