import { writable, derived, get, type Writable, type Readable } from 'svelte/store';

export type BootActivityItem = {
  slug: string;
  text: string;
  index: number;
  complete: boolean;
  value?: string | number;
};

const activities: Writable<Map<string, BootActivityItem>> = writable(new Map());

export const bootActivities: Readable<BootActivityItem[]> = derived(
  activities,
  ($activities) => Array.from($activities.values()).sort((a, b) => a.index - b.index)
);

export const bootProgress: Readable<number> = derived(
  activities,
  ($activities) => {
    const items = Array.from($activities.values());
    if (items.length === 0) return 0;
    const completed = items.filter(item => item.complete).length;
    return Math.round((completed / items.length) * 100);
  }
);

let activityIndex = 0;

export function startBootActivity(slug: string, text: string): void {
  activities.update(($activities) => {
    if (!$activities.has(slug)) {
      $activities.set(slug, {
        slug,
        text,
        index: activityIndex++,
        complete: false,
      });
    } else {
      const existing = $activities.get(slug)!;
      existing.complete = false;
      $activities.set(slug, existing);
    }
    return $activities;
  });
}

export function updateBootActivity(slug: string, value: string | number): void {
  activities.update(($activities) => {
    const item = $activities.get(slug);
    if (item) {
      item.value = value;
      $activities.set(slug, item);
    }
    return $activities;
  });
}

export function completeBootActivity(slug: string, value?: string | number): void {
  activities.update(($activities) => {
    const item = $activities.get(slug);
    if (item) {
      item.complete = true;
      if (value !== undefined) {
        item.value = value;
      }
      $activities.set(slug, item);
    }
    return $activities;
  });
}

export function resetBootActivities(): void {
  activities.set(new Map());
  activityIndex = 0;
}
