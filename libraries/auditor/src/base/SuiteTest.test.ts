import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SuiteTest } from './SuiteTest'
import type { ISuite } from './Suite'
import { Emitter } from './Emitter'
import { Nip01ClientMessageGenerator } from '#src/nips/Nip01/utils/generators.js'
import { Ingestor } from './Ingestor'
import type { Note } from '#src/nips/Nip01/interfaces'
import { Sampler } from './Sampler'
import { SuiteState } from './SuiteState'

// Mock the Nip01ClientMessageGenerator
vi.mock('#src/nips/Nip01/utils/generators.js', () => ({
  Nip01ClientMessageGenerator: {
    REQ: vi.fn().mockImplementation((subId, filters) => JSON.stringify(['REQ', subId, ...filters])),
    EVENT: vi.fn().mockImplementation((event) => JSON.stringify(['EVENT', event])),
    CLOSE: vi.fn().mockImplementation((subId) => JSON.stringify(['CLOSE', subId]))
  }
}))

// Mock WebSocket that simulates browser behavior
class BrowserLikeWebSocket {
  private _readyState: number = 0 // CONNECTING
  private handlers: Record<string, Function[]> = {}
  public CONNECTED: boolean = false
  public CLOSED: boolean = false

  connect = vi.fn().mockImplementation(() => {
    this._readyState = 0 // CONNECTING
    this.CONNECTED = false
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this._readyState = 1 // OPEN
        this.CONNECTED = true
        this.emit('open', {})
        resolve()
      }, 100)
    })
  })

  ready = vi.fn().mockImplementation(() => {
    return new Promise<void>(resolve => {
      if (this._readyState === 1) {
        resolve();
        return;
      }
      setTimeout(() => {
        this._readyState = 1; // OPEN
        this.CONNECTED = true;
        this.emit('open', {});
        resolve();
      }, 100);
    });
  })

  send = vi.fn().mockImplementation((data) => {
    if (this._readyState !== 1) {
      throw new Error('InvalidStateError: Failed to execute \'send\' on \'WebSocket\': Still in CONNECTING state.')
    }
    // If it's a REQ message, simulate an EVENT and EOSE response
    const message = JSON.parse(data);
    if (message[0] === 'REQ') {
      setTimeout(() => {
        // Send a mock event
        this.emit('message', { 
          data: JSON.stringify(['EVENT', message[1], {
            id: 'test-event',
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            content: 'test',
            tags: [],
            pubkey: 'test-pubkey',
            sig: 'test-sig'
          }])
        });
        // Then send EOSE
        this.emit('message', { data: JSON.stringify(['EOSE', message[1]]) });
      }, 100);
    }
  })

  close = vi.fn()
  terminate = vi.fn()
  off = vi.fn()

  on(event: string, handler: Function) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
  }

  emit(event: string, data: any) {
    console.log(`WebSocket emitting ${event}:`, data);
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data))
    }
  }
}

// Concrete implementation of SuiteTest for testing
class TestSuiteTest extends SuiteTest {
  slug = 'test-suite'
  
  get filters() {
    return [{ kinds: [1], limit: 1 }]
  }

  // Override testable for testing race condition
  async testable() {
    // For testing the error case, don't wait
    if (this.suite.testKey === 'error-test') {
      return
    }
    // Otherwise use the normal implementation
    return super.testable()
  }
}

describe('SuiteTest', () => {
  let suiteTest: TestSuiteTest
  let mockSocket: BrowserLikeWebSocket
  let mockSuite: ISuite

  beforeEach(() => {
    mockSocket = new BrowserLikeWebSocket()
    mockSuite = {
      slug: 'test',
      socket: mockSocket as any,
      state: new SuiteState(),
      messageValidators: {},
      jsonValidators: {},
      requires: ['websocket'],
      doNotStoreMessageTypes: [],
      pretest: false,
      testKey: '',
      data: {},
      setup: vi.fn(),
      ready: vi.fn(),
      reset: vi.fn(),
      test: vi.fn().mockImplementation(async function(this: any) {
        await this.ready();
        if(this?.sampler?.samplable) {
          const samplingSuccessful = await this.sampler.sample();
          if (samplingSuccessful) {
            const poops: Record<string, any> = {};
            for(const ingestor of this.sampler.ingestors) {
              const testKey = ingestor.parent;
              poops[testKey] = ingestor.poop();
            }
            this.state.set('samples', poops);
            Emitter.emit('auditor.suite:samples', this.slug, poops);
            
            // Only run tests if sampling was successful
            for(const testName in this.testers) {
              const suiteTest = this.testers[testName];
              await suiteTest.run();
            }
          }
        }
        return { pass: true };
      }),
      registerIngestors: vi.fn(),
      registerIngestor: vi.fn((testSlug: string, ingestor: Ingestor) => {
        if(!mockSuite.sampler) {
          const sampler = new Sampler(mockSocket as any);
          Object.defineProperty(mockSuite, 'sampler', {
            get: () => sampler
          });
        }
        ingestor.belongsTo = testSlug;
        mockSuite.sampler.registerIngestor(ingestor);
      }),
      setupHandlers: vi.fn(),
      validateJson: vi.fn(),
      sampler: undefined
    } as ISuite
    suiteTest = new TestSuiteTest(mockSuite)
  })

  describe('WebSocket Connection State', () => {
    it('should throw error when sending message while socket is connecting', async () => {
      mockSuite.testKey = 'error-test' // This will trigger the no-wait path
      
      // We need to await the error from prepare()
      await expect(suiteTest.prepare()).rejects.toThrow('InvalidStateError: Failed to execute \'send\' on \'WebSocket\': Still in CONNECTING state.')
    })

    it('should wait for socket to be connected before sending messages', async () => {
      await suiteTest.run()
      
      // Verify that send was called with the correct REQ message
      expect(mockSocket.send).toHaveBeenCalled()
      const sendArg = mockSocket.send.mock.calls[0][0]
      expect(JSON.parse(sendArg)[0]).toBe('REQ')
    })
  })

  describe('Sampling', () => {
    it('should sample relay data before running tests', async () => {
      // Create a mock ingestor that properly extends the Ingestor class
      class TestIngestor extends Ingestor {
        private data = { test: 'data' };
        
        feed(note: Note): void {
          // Just store the test data
          this.complete();
        }

        poop(): any {
          return this.data;
        }
      }

      const mockIngestor = new TestIngestor(1);
      vi.spyOn(mockIngestor, 'feed');
      vi.spyOn(mockIngestor, 'poop');
      vi.spyOn(mockIngestor, 'completed');

      // Register the ingestor with both the suite and test instance
      mockSuite.registerIngestor('test-suite', mockIngestor);
      suiteTest.suiteTestIngest(mockIngestor);

      // Run the suite's test method first to collect samples
      await mockSuite.test();
      
      // Then run the individual test
      await suiteTest.run();

      // Verify that the sampler was initialized and used
      const suite = (suiteTest as any).suite;
      expect(suite.sampler).toBeDefined();
      expect(suite.sampler.samplable).toBe(true);
      
      // Verify that the sample data was stored in the state
      const samples = suite.state.get('samples');
      expect(samples).toBeDefined();
      expect(samples['test-suite']).toBeDefined();
      expect(samples['test-suite'].test).toBe('data');

      // Verify that the ingestor was actually used
      expect(mockIngestor.feed).toHaveBeenCalled();
      expect(mockIngestor.completed).toHaveBeenCalled();
      expect(mockIngestor.poop).toHaveBeenCalled();
    });

    it('should skip tests when sampling fails', async () => {
      // Create a mock ingestor
      class TestIngestor extends Ingestor {
        private data = { test: 'data' };
        
        feed(note: Note): void {
          this.complete();
        }

        poop(): any {
          return this.data;
        }
      }

      const mockIngestor = new TestIngestor(1);
      vi.spyOn(mockIngestor, 'feed');
      vi.spyOn(mockIngestor, 'poop');
      vi.spyOn(mockIngestor, 'completed');

      // Register the ingestor with both the suite and test instance
      mockSuite.registerIngestor('test-suite', mockIngestor);
      suiteTest.suiteTestIngest(mockIngestor);
      
      // Make sure the test is registered in the mock suite's testers
      (mockSuite as any).testers = { 'test-suite': suiteTest };

      // Mock the sampler.sample method to fail
      const failingSampler = new Sampler(mockSocket as any);
      vi.spyOn(failingSampler, 'sample').mockResolvedValue(false);
      
      // Replace the real sampler with our failing one
      Object.defineProperty(mockSuite, 'sampler', {
        get: () => failingSampler
      });
      
      // Spy on the run and test methods to verify they're not called
      const runSpy = vi.spyOn(suiteTest, 'run');
      
      // Run the suite's test method
      await mockSuite.test();

      // Verify that the suite did NOT run the test when sampling failed
      expect(runSpy).not.toHaveBeenCalled();
      
      // This confirms the current behavior (tests are skipped when sampling fails)
    });
  });
}) 