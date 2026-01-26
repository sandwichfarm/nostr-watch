<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import { cn, flyAndScale } from "$lib/utils/ui.js";
  import { Input } from "$lib/components/ui/input/index.js";

  export type DropdownSelectOption<T extends string = string> = {
    value: T;
    label: string;
    group?: string;
    searchText?: string;
    disabled?: boolean;
    className?: string;
    meta?: any;
  };

  export let label: string;
  export let options: DropdownSelectOption[] = [];
  export let value: string | null = null;
  export let placeholder = "Select";

  export let name: string | undefined = undefined;
  export let required = false;
  export let disabled = false;
  export let form: string | undefined = undefined;
  export let describedBy: string | undefined = undefined;
  export let invalid: boolean | "grammar" | "spelling" | undefined = undefined;

  export let filterPlaceholder = "Filter…";
  export let emptyText = "No matches";
  export let showFilter = true;
  export let maxHeightPx = 260;
  export let align: "left" | "right" = "left";

  let className: string | undefined = undefined;
  export { className as class };

  const dispatch = createEventDispatcher<{
    change: { value: string | null };
    openchange: { open: boolean };
  }>();

  const listId = `dropdown-${Math.random().toString(36).slice(2)}`;

  let open = false;
  let detailsEl: HTMLDetailsElement | null = null;
  let summaryEl: HTMLElement | null = null;
  let filterEl: HTMLInputElement | null = null;
  let optionEls: (HTMLButtonElement | null)[] = [];
  let activeIndex = -1;

  let filterText = "";
  $: normalizedFilter = filterText.trim().toLowerCase();
  $: filteredOptions = normalizedFilter.length
    ? options.filter((opt) => {
        const hay = `${opt.label} ${opt.searchText ?? ""}`.toLowerCase();
        return hay.includes(normalizedFilter);
      })
    : options;

  type RenderItem =
    | { kind: "separator"; key: string }
    | { kind: "option"; key: string; option: DropdownSelectOption; optionIndex: number };

  $: renderItems = (() => {
    const items: RenderItem[] = [];
    let prevGroup: string | undefined = undefined;
    for (let idx = 0; idx < filteredOptions.length; idx++) {
      const opt = filteredOptions[idx];
      const nextGroup = opt?.group ?? "";
      const prev = prevGroup ?? nextGroup;
      if (idx > 0 && nextGroup !== prev) {
        items.push({ kind: "separator", key: `sep-${idx}-${prev}-${nextGroup}` });
      }
      items.push({ kind: "option", key: `opt-${opt.value}`, option: opt, optionIndex: idx });
      prevGroup = nextGroup;
    }
    return items;
  })();

  $: selected = options.find((opt) => opt.value === value) ?? null;
  $: display = selected?.label ?? placeholder;
  $: summaryText = `${label}: ${display}`;

  function findSelectedIndex(): number {
    if (!value) return -1;
    return filteredOptions.findIndex((opt) => opt.value === value);
  }

  async function focusFilter() {
    if (!showFilter) return;
    await tick();
    filterEl?.focus();
    filterEl?.select?.();
  }

  async function focusActiveOption() {
    await tick();
    const idx = activeIndex >= 0 ? activeIndex : 0;
    queueMicrotask(() => optionEls[idx]?.focus?.());
  }

  async function openDropdown() {
    if (disabled) return;
    open = true;
    filterText = "";
    activeIndex = findSelectedIndex();
    if (showFilter) await focusFilter();
    else await focusActiveOption();
  }

  function closeDropdown({ restoreFocus = true } = {}) {
    open = false;
    filterText = "";
    activeIndex = -1;
    if (restoreFocus) {
      queueMicrotask(() => summaryEl?.focus?.());
    }
  }

  function selectValue(next: string | null) {
    value = next;
    dispatch("change", { value: next });
    closeDropdown();
  }

  function moveActive(delta: number) {
    if (!filteredOptions.length) return;

    const max = filteredOptions.length - 1;
    let next = activeIndex;
    if (next < 0) next = delta > 0 ? -1 : max + 1;

    for (let i = 0; i < filteredOptions.length; i++) {
      next = Math.max(0, Math.min(max, next + delta));
      const opt = filteredOptions[next];
      if (opt && !opt.disabled) {
        activeIndex = next;
        queueMicrotask(() => optionEls[next]?.focus?.());
        return;
      }
      if ((delta < 0 && next === 0) || (delta > 0 && next === max)) return;
    }
  }

  function onSummaryKeydown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void openDropdown();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  }

  function onPanelKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      // Skip disabled entries.
      if (filteredOptions[0]?.disabled) moveActive(1);
      else queueMicrotask(() => optionEls[0]?.focus?.());
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      activeIndex = Math.max(0, filteredOptions.length - 1);
      // Skip disabled entries.
      if (filteredOptions[activeIndex]?.disabled) moveActive(-1);
      else queueMicrotask(() => optionEls[activeIndex]?.focus?.());
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      const opt = filteredOptions[activeIndex];
      if (opt && !opt.disabled) {
        e.preventDefault();
        selectValue(opt.value);
      }
    }
  }

  function handleToggle() {
    if (!detailsEl) return;

    // Browser toggles `open` immediately; we keep our own state so we can animate.
    if (detailsEl.open && !open) {
      void openDropdown();
      dispatch("openchange", { open: true });
      return;
    }

    if (!detailsEl.open && open) {
      closeDropdown({ restoreFocus: false });
      dispatch("openchange", { open: false });
      return;
    }

    // Keep DOM attribute in sync when we closed programmatically.
    if (!open && detailsEl.open) {
      detailsEl.open = false;
      dispatch("openchange", { open: false });
    }
  }

  function onDocumentPointerDown(e: PointerEvent) {
    if (!open) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (!detailsEl?.contains(target)) closeDropdown({ restoreFocus: false });
  }

  onMount(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
  });

  onDestroy(() => {
    if (typeof document === "undefined") return;
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  });
</script>

<details
  bind:this={detailsEl}
  open={open}
  class={cn(
    "nw-dropdown relative inline-block text-sm",
    // When callers pass `opacity-*` for a dimmed trigger, it also affects the
    // panel. Force full opacity while open.
    open && "!opacity-100",
    // Ensure the open dropdown stacks above table headers/content.
    open && "z-[6500]",
    className
  )}
  on:toggle={handleToggle}
>
  <summary
    bind:this={summaryEl}
    class={cn(
      "nw-dropdown__summary inline-flex items-center gap-2 rounded-sm px-2 py-1 border border-border bg-popover text-popover-foreground hover:bg-muted select-none",
      disabled && "opacity-50 cursor-not-allowed pointer-events-none"
    )}
    aria-haspopup="listbox"
    aria-controls={listId}
    aria-expanded={open}
    aria-disabled={disabled}
    aria-describedby={describedBy}
    aria-invalid={invalid}
    on:keydown={onSummaryKeydown}
  >
    <span class="italic opacity-80">{label}:</span>
    <span class="opacity-90">{display}</span>
    <span class={cn("nw-dropdown__chevron ml-1 opacity-60 transition-transform", open && "rotate-180")}>
      ▼
    </span>
  </summary>

  {#if open}
    <div
      class={cn(
        "nw-dropdown__panel absolute mt-2 min-w-[260px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
        align === "right" ? "right-0" : "left-0"
      )}
      in:flyAndScale={{ y: -6, start: 0.98, duration: 140 }}
      out:flyAndScale={{ y: -6, start: 0.98, duration: 120 }}
      on:keydown={onPanelKeydown}
    >
      <div class="px-3 py-2 text-xs uppercase tracking-wide opacity-70">{label}</div>
      {#if showFilter}
        <div class="px-3 pb-2">
          <Input
            bind:input={filterEl}
            value={filterText}
            on:input={(e) => (filterText = (e.currentTarget as HTMLInputElement).value)}
            placeholder={filterPlaceholder}
            class="h-8 bg-background"
            disabled={disabled}
            aria-label={`${label} filter`}
          />
        </div>
      {/if}

      <div
        id={listId}
        role="listbox"
        aria-label={label}
        class="max-h-[var(--nw-dropdown-maxh)] overflow-auto px-1 pb-2"
        style={`--nw-dropdown-maxh:${Math.max(120, maxHeightPx)}px`}
      >
        {#if filteredOptions.length === 0}
          <div class="px-2 py-2 text-xs opacity-60">{emptyText}</div>
        {:else}
          {#each renderItems as item (item.key)}
            {#if item.kind === "separator"}
              <div class="mx-2 my-1 border-t border-border/60" role="separator" aria-hidden="true" />
            {:else}
              <button
                bind:this={optionEls[item.optionIndex]}
                type="button"
                role="option"
                aria-selected={item.option.value === value}
                disabled={disabled || item.option.disabled}
                class={cn(
                  "nw-dropdown__option w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-left",
                  item.option.className,
                  item.option.value === value && "bg-accent text-accent-foreground",
                  item.optionIndex === activeIndex && "bg-accent/70",
                  !(disabled || item.option.disabled) && "hover:bg-accent hover:text-accent-foreground"
                )}
                on:click={() => selectValue(item.option.value)}
                on:mouseenter={() => (activeIndex = item.optionIndex)}
              >
                <span class="flex-1">{item.option.label}</span>
                <slot name="optionRight" option={item.option} />
              </button>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  {#if name}
    <select
      class="nw-dropdown__native"
      aria-hidden="true"
      tabindex="-1"
      {name}
      {form}
      {required}
      {disabled}
      value={value ?? ""}
    >
      {#if !required}
        <option value="">{placeholder}</option>
      {/if}
      {#each options as opt (opt.value)}
        <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      {/each}
    </select>
  {/if}
</details>

<style lang="postcss">
  /* Keep the panel in flow for out-transitions (override UA stylesheet). */
  details.nw-dropdown:not([open]) > .nw-dropdown__panel {
    display: block;
  }

  details.nw-dropdown > summary::-webkit-details-marker {
    display: none;
  }

  .nw-dropdown__native {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    left: -9999px;
    top: 0;
  }
  .nw-dropdown__option:disabled {
    @apply opacity-40 cursor-not-allowed;
  }
</style>
