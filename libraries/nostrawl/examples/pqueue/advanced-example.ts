import { nostrawl } from '../../src';
import { TrawlerOptions, Progress } from '../../src/types';
import { Event } from 'nostr-tools';

/**
 * Advanced example demonstrating the usage of the PQueue adapter
 * 
 * This example shows how to:
 * 1. Configure the PQueue adapter with advanced options
 * 2. Set up custom event handlers and parsers
 * 3. Implement custom filtering and validation
 * 4. Handle progress updates
 */
async function main() {
  // Define the relays to trawl
  const relays = [
    'wss://relay.damus.io',
    'wss://nostr.fmt.wiz.biz',
    'wss://nostr.bitcoiner.social',
    'wss://relay.nostr.band',
    'wss://nostr.mom',
  ];

  // Track statistics
  let totalEvents = 0;
  let textNotes = 0;
  let reactions = 0;
  let otherEvents = 0;
  let lastProgressUpdate = Date.now();

  // Custom parser function to process events
  const customParser = async (trawler: any, event: Event, job: any) => {
    // Increment total events counter
    totalEvents++;
    
    // Categorize events by kind
    if (event.kind === 1) {
      textNotes++;
    } else if (event.kind === 7) {
      reactions++;
    } else {
      otherEvents++;
    }
    
    // Log event details
    console.log(`Event ${totalEvents}: Kind ${event.kind} from ${event.pubkey.substring(0, 8)}...`);
    
    // Example: Only process events with content length > 100
    if (event.kind === 1 && event.content && event.content.length > 100) {
      console.log(`Long text note: ${event.content.substring(0, 50)}...`);
    }
  };

  // Custom validator function to filter events
  const customValidator = (trawler: any, event: Event) => {
    // Example: Only accept events from the last 7 days
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    return event.created_at >= sevenDaysAgo;
  };

  // Custom progress handler
  const handleProgress = (progress: Progress) => {
    const now = Date.now();
    // Only log progress every 5 seconds to avoid console spam
    if (now - lastProgressUpdate > 5000) {
      console.log(`Progress: Found ${progress.found} events, Rejected ${progress.rejected} events`);
      console.log(`Statistics: Text Notes: ${textNotes}, Reactions: ${reactions}, Other: ${otherEvents}`);
      lastProgressUpdate = now;
    }
  };

  // Configure the PQueue adapter options
  const options: TrawlerOptions = {
    // Specify the adapter to use
    adapter: 'pqueue',
    
    // PQueue specific options
    adapterOptions: {
      // Number of concurrent jobs
      concurrency: 3,
      
      // Timeout for each job in milliseconds
      timeout: 60000,
      
      // Whether to throw an error when a job times out
      throwOnTimeout: false,
      
      // Maximum number of jobs per interval (must be a number >= 1)
      intervalCap: 5,
      
      // Interval in milliseconds
      interval: 2000,
      
      // Whether to carry over concurrency count
      carryoverConcurrencyCount: true,
      
      // Whether to auto-start the queue
      autoStart: true,
    },
    
    // General trawler options
    queueName: 'pqueue-advanced-example',
    repeatWhenComplete: true,
    relaysPerBatch: 2,
    restDuration: 2000,
    progressEvery: 5,
    
    // Cache configuration
    cache: {
      enabled: true,
      path: './cache/pqueue-advanced-example',
    },
    
    // Filter for events (example: text notes and reactions)
    filters: {
      kinds: [1, 7],
    },
    
    // Custom parser
    parser: customParser,
    
    // Custom validator
    validator: customValidator,
    
    // Since timestamp (7 days ago)
    since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60),
  };

  // Create a trawler instance with the PQueue adapter
  const trawler = nostrawl(relays, options);

  // Set up event handlers
  trawler.on('queue_active', () => {
    console.log('Queue is active - processing jobs');
  });

  trawler.on('queue_completed', (result) => {
    console.log('Job completed successfully');
  });

  trawler.on('queue_error', (error) => {
    console.error('Queue error:', error);
  });

  trawler.on('queue_idle', () => {
    console.log('Queue is idle - all jobs completed');
    console.log(`Final Statistics: Total Events: ${totalEvents}, Text Notes: ${textNotes}, Reactions: ${reactions}, Other: ${otherEvents}`);
  });

  trawler.on('progress', handleProgress);

  // Initialize and run the trawler
  try {
    console.log('Initializing trawler...');
    await trawler.init();
    console.log('Trawler initialized');
    
    console.log('Starting trawler...');
    await trawler.run();
    console.log('Trawler started');
    
    // Example of pausing and resuming
    setTimeout(() => {
      console.log('Pausing trawler for 10 seconds...');
      trawler.pause();
      
      setTimeout(() => {
        console.log('Resuming trawler...');
        trawler.start();
      }, 10000);
    }, 30000);
    
    // Example of stopping the trawler after 2 minutes
    setTimeout(() => {
      console.log('Stopping trawler...');
      trawler.stop();
      console.log('Trawler stopped');
    }, 120000);
  } catch (error) {
    console.error('Error running trawler:', error);
  }
}

// Run the example
main().catch(console.error); 