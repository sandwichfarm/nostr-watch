// Entry point for relaymon
// This file exports functionality from the main module

// Export all from main module
export * from "./src/core/main.ts";

// Run the main function if this module is executed directly
if (import.meta.main) {
  import("./src/core/main.ts").then(({ main }) => {
    main();
  });
} 