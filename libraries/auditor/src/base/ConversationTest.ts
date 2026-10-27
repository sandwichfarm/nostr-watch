import { SuiteTest } from './SuiteTest.js';
import type { ISuite } from './Suite.js';
import { MessageSession } from './MessageSession.js';

/** Multi-step tests own their connections instead of relying on the EOSE handler. */
export abstract class ConversationTest extends SuiteTest {
  private readonly sessions = new Set<MessageSession>();
  private rejectRun?: (error: Error) => void;
  private active = false;

  constructor(suite: ISuite) {
    super(suite);
    this.setAbortListener(false);
  }

  protected abstract execute(): Promise<void>;

  protected async openSession(url?: string): Promise<MessageSession> {
    if (!this.active) throw new Error('Conversation is not running');
    const session = new MessageSession(this.socket.fork(url), this.timeoutMs);
    this.sessions.add(session);
    await session.connect();
    if (!this.active) {
      session.dispose();
      throw new Error('Conversation is no longer running');
    }
    return session;
  }

  protected skip(message: string): void {
    const behavior = this.expect.behavior;
    behavior.skip = true;
    try {
      behavior.toBeOk(true, message);
    } finally {
      behavior.skip = false;
    }
  }

  async run(): Promise<void> {
    if (this.slug === 'unset') throw new Error('slug of SuiteTest must be set');
    this.resetResults();
    this.suite.reset();
    this.suite.testKey = this.slug;
    this.active = true;
    this.setAbortListener(true);
    let timeout: ReturnType<typeof setTimeout>;
    try {
      const interrupted = new Promise<never>((_, reject) => {
        this.rejectRun = reject;
        timeout = setTimeout(() => reject(new Error(`Conversation timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
      });
      await Promise.race([this.execute(), interrupted]);
      if (this.expect.results.length === 0 && this.expect.skipped.length === 0) {
        this.expect.behavior.toBeOk(false, 'Conversation completed without assertions');
      }
    } catch (error) {
      this.expect.behavior.toBeOk(false, `Conversation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.active = false;
      this.setAbortListener(false);
      this.rejectRun = undefined;
      clearTimeout(timeout);
      for (const session of this.sessions) session.dispose();
      this.sessions.clear();
      this.finish();
      if (this.resulter.result.skipped.length > 0) this.resulter.set('pass', false);
    }
  }

  abort(): void {
    if (!this.active) return;
    this.active = false;
    this.rejectRun?.(new Error('Conversation aborted'));
    for (const session of this.sessions) session.dispose();
  }
}
