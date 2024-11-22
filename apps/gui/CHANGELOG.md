# @careswitch/svelte-data-table

## 0.6.3

### Patch Changes

- 267e6ba: Added allRows getter to retrieve all unpaginated filtered and sorted table rows

## 0.6.2

### Patch Changes

- e5b1ed1: fix: `totalPages` should react to changes in base rows

## 0.6.1

### Patch Changes

- e44c770: perf: filter matching, sort handling null/undefined, non-capturing group for global filter regex

## 0.6.0

### Minor Changes

- 4ba9232: Custom `sorter` fn now parameterizes `getValue()` return values in addition to row objects

## 0.5.4

### Patch Changes

- 17b1089: Pagination accessors should react to filter state

## 0.5.3

### Patch Changes

- 2ee673a: rows getter should react to `originalData`

## 0.5.2

### Patch Changes

- ed69b69: Updating `baseRows` should retrigger filterState

## 0.5.1

### Patch Changes

- 94f0694: Ensure row access doesn't mutate state, see: https://github.com/sveltejs/svelte/issues/12457

## 0.5.0

### Minor Changes

- 48cfdcf: Introduce `id` in column definition to allow multiple columns for the same key

## 0.4.0

### Minor Changes

- 26bea0d: Rename `filters` to `filterState`; introduce `sortState`, refactor filter mutators to reassign object

## 0.3.0

### Minor Changes

- 57b1ab6: Expose read and write access to base row data

### Patch Changes

- 57b1ab6: JSDoc comments for better documentation
- 57b1ab6: Expand test coverage for edge cases
- 57b1ab6: Performance improvements with fine-grained reactivity

## 0.2.2

### Patch Changes

- 58f6cdb: Package description, license, and keywords

## 0.2.1

### Patch Changes

- df3d810: Add project homepage

## 0.2.0

### Minor Changes

- efa074b: Public publishing with changesets
