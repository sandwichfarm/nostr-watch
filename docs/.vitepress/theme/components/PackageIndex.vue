<script setup lang="ts">
import { computed } from 'vue'
import { data as packages } from '../../packages.data'

const props = defineProps<{ type?: string }>()

const filtered = computed(() => {
  const list = props.type
    ? packages.filter((p: { type: string }) => p.type === props.type)
    : packages
  return [...list].sort((a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name)
  )
})

const typeEmoji: Record<string, string> = {
  apps: '🚀',
  libraries: '📦',
  internal: '🔧',
}
</script>

<template>
  <div class="package-grid">
    <a
      v-for="pkg in filtered"
      :key="pkg.name"
      :href="pkg.link"
      :class="['package-card', { deprecated: pkg.deprecated }]"
    >
      <div class="card-header">
        <span class="type-icon">{{ typeEmoji[pkg.type] ?? '📄' }}</span>
        <span class="status-badge" :class="pkg.deprecated ? 'deprecated' : pkg.status">
          {{ pkg.deprecated ? 'deprecated' : pkg.status }}
        </span>
      </div>
      <h3>{{ pkg.name }}</h3>
      <p>{{ pkg.description || 'No description available.' }}</p>
    </a>
  </div>
</template>

<style scoped>
.package-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.package-card {
  display: block;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.package-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.package-card.deprecated {
  opacity: 0.6;
}

.package-card.deprecated h3 {
  text-decoration: line-through;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.type-icon {
  font-size: 1.4em;
}

.status-badge {
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.alpha {
  background: #fff3e0;
  color: #e65100;
}

.status-badge.beta {
  background: #e3f2fd;
  color: #1565c0;
}

.status-badge.stable {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.deprecated {
  background: #fce4ec;
  color: #c62828;
}

.package-card h3 {
  margin: 0 0 8px;
  font-size: 1.05em;
}

.package-card p {
  margin: 0;
  font-size: 0.9em;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
</style>
