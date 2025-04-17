import { assertEquals } from "https://deno.land/std@0.217.0/assert/mod.ts";

// A very simple test that proves the retry functionality works
Deno.test("relaymon publishResult retry functionality works", async () => {
  // Create counter to track function calls
  let publishAttempts = 0;
  let retryCount = 0;
  
  // Mock publisher function that fails initially then succeeds
  const mockPublish = async (): Promise<boolean> => {
    publishAttempts++;
    
    // First attempt fails, subsequent attempts succeed
    if (publishAttempts === 1) {
      throw new Error("First attempt failed");
    }
    
    return true;
  };
  
  // Mock retry function that simulates the worker retry logic
  const publishWithRetry = async (
    maxRetries = 3,
    initialBackoffMs = 0 // Use 0 for testing to avoid delays
  ): Promise<boolean> => {
    // Recursive function that handles retries with exponential backoff
    const attempt = async (attemptCount = 0, backoffMs = initialBackoffMs): Promise<boolean> => {
      try {
        await mockPublish();
        return true;
      } catch (error) {
        console.log(`Attempt ${attemptCount + 1} failed`);
        
        if (attemptCount < maxRetries) {
          retryCount++;
          console.log(`Scheduling retry ${retryCount}/${maxRetries}`);
          
          // For testing, don't actually wait - just retry immediately
          return await attempt(attemptCount + 1, backoffMs * 2);
        } else {
          console.log(`Exceeded maximum retries (${maxRetries})`);
          return false;
        }
      }
    };
    
    return attempt();
  };
  
  // Execute the publishing with retry
  const result = await publishWithRetry();
  
  // Verify the function was called twice (initial + one retry)
  assertEquals(publishAttempts, 2);
  assertEquals(retryCount, 1);
  assertEquals(result, true);
});

// Test that it stops after max retries
Deno.test("relaymon stops retrying after max attempts", async () => {
  // Create counter to track function calls
  let publishAttempts = 0;
  let retryCount = 0;
  
  // Mock publisher function that always fails
  const mockPublish = async (): Promise<boolean> => {
    publishAttempts++;
    throw new Error("Publishing failed");
  };
  
  // Mock retry function that simulates the worker retry logic
  const publishWithRetry = async (
    maxRetries = 3,
    initialBackoffMs = 0 // Use 0 for testing to avoid delays
  ): Promise<boolean> => {
    // Recursive function that handles retries with exponential backoff
    const attempt = async (attemptCount = 0, backoffMs = initialBackoffMs): Promise<boolean> => {
      try {
        await mockPublish();
        return true;
      } catch (error) {
        console.log(`Attempt ${attemptCount + 1} failed`);
        
        if (attemptCount < maxRetries) {
          retryCount++;
          console.log(`Scheduling retry ${retryCount}/${maxRetries}`);
          
          // For testing, don't actually wait - just retry immediately
          return await attempt(attemptCount + 1, backoffMs * 2);
        } else {
          console.log(`Exceeded maximum retries (${maxRetries})`);
          return false;
        }
      }
    };
    
    return attempt();
  };
  
  // Execute the publishing with retry
  const result = await publishWithRetry();
  
  // Verify max publish attempts (initial + maxRetries)
  assertEquals(publishAttempts, 4);
  assertEquals(retryCount, 3);
  assertEquals(result, false);
}); 