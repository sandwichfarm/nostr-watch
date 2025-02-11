import { Nocap } from "npm:@nostrwatch/nocap";
import EveryAdapterDefault from "npm:@nostrwatch/nocap-every-adapter-default";
import { Publisher, Kind30166 } from "npm:@nostrwatch/publisher";
import { relayHostnameDedup } from "./hostnames.ts";
import { persistResult } from "./db.ts";
import { delay } from "npm:@nostrwatch/utils";
import { getLogger } from "./logger.ts";
import { RetryManager } from "./retryManager.ts";
import chalk from "npm:chalk";
chalk.level = 1;

export class Worker {
  private relayRetries: Map<string, number> = new Map();
  private logger = getLogger("Worker");
  private config: any;
  private publisher: Publisher;
  private retryManager: RetryManager;

  constructor(
    private pubkey: string,
    private queueManager: any,
    config: any
  ) {
    this.config = config;
    this.publisher = new Publisher(this.pubkey, config.publisher.relays);
    this.retryManager = new RetryManager(config.relaymon.retry.expiry);
  }

  async processRelay(relayUrl: string): Promise<void> {
    try {
      const nocap = new Nocap(relayUrl, {
        timeouts: this.config.relaymon.checks.options.timeout,
        logLevel: "debug",
      });
      await nocap.useAdapters(Object.values(EveryAdapterDefault));
      const result = await nocap.check(
        this.config.relaymon.checks.enabled || ["open", "read"]
      );
      const dedupedResult = await relayHostnameDedup(result);
      if (!dedupedResult.ignore && result.open.data === true) {
        await this.publishResult(dedupedResult);
      } 
      persistResult(dedupedResult);
      this.progressMessage(relayUrl, result, false);
      this.relayRetries.set(relayUrl, 0);
    } catch (error: any) {
      this.logger.error(`Error processing relay ${relayUrl}: ${error.message}`);
      this.progressMessage(relayUrl, {}, true);
      this.scheduleRetry(relayUrl);
    }
  }

  async publishResult(result: any): Promise<void> {
    try {
      // const event$ = new Kind30166(Deno.env.get("DAEMON_PUBKEY"));
      // event$.generateEvent(result);
      // const privkey = Deno.env.get("DAEMON_PRIVKEY") || "";
      // const signedEvent = event$.signEvent(privkey);
      // Uncomment the next two lines if you want to publish the event:
      // await this.publisher.publishEvent(signedEvent);
      // this.logger.info(`Published event for relay ${result.url}`);
    } catch (error: any) {
      this.logger.error(`Publish failed for ${result.url}: ${error.message}`);
      this.queueManager.addPublishJob(async () => {
        await delay(1000);
        // Optionally, retry publishing here.
      });
    }
  }

  scheduleRetry(relayUrl: string): void {
    let currentRetries = this.relayRetries.get(relayUrl) || 0;
    currentRetries++;
    this.relayRetries.set(relayUrl, currentRetries);
    const delayMs = this.retryManager.getDelay(currentRetries);
    this.logger.debug(
      `Scheduling retry #${currentRetries} for ${relayUrl} in ${delayMs} ms`
    );
    this.queueManager.addCheckJob(async () => {
      await delay(delayMs);
      await this.processRelay(relayUrl);
    });
  }

  progressMessage(
    url: string,
    result: any = {},
    error: boolean = false
  ): Promise<void> {
    const failure = chalk.red;
    const success = chalk.bold.green;
    const mute = chalk.gray;

    let duration = 0;
    const incD = (_d: number) => {
      if (_d > 0) duration += _d;
    };

    let progress = "";
    progress += `${url}: `;

    const checks: string[] = this.config.relaymon.checks.enabled || [];
    if (checks.includes("open")) {
      progress += `${
        result?.open?.data === true ? success("online") : failure("offline")
      } `;
      incD(result?.open?.duration || 0);
    }
    if (checks.includes("read")) {
      progress += `${
        result?.read?.data === true ? success("readable") : failure("unreadable")
      } `;
      incD(result?.read?.duration || 0);
    }
    if (checks.includes("write")) {
      progress += `${
        result?.write?.data === true ? success("writable") : failure("unwritable")
      } `;
      incD(result?.write?.duration || 0);
    }
    if (checks.includes("ssl")) {
      progress += `${
        Object.keys(result?.ssl?.data || {}).length
          ? success("ssl")
          : failure("ssl")
      } `;
      incD(result?.ssl?.duration || 0);
    }
    if (checks.includes("dns")) {
      progress += `${
        Object.keys(result?.dns?.data || {}).length
          ? success("dns")
          : failure("dns")
      } `;
      incD(result?.dns?.duration || 0);
    }
    if (checks.includes("geo")) {
      progress += `${
        Object.keys(result?.geo?.data || {}).length
          ? success("geo")
          : failure("geo")
      } `;
      incD(result?.geo?.duration || 0);
    }
    if (checks.includes("info")) {
      progress += `${
        Object.keys(result?.info?.data || {}).length
          ? success("info")
          : failure("info")
      } `;
      incD(result?.info?.duration || 0);
    }

    if (!error) {
      progress += `${(duration / 1000).toFixed(2)} seconds `;
    }
    if (error) {
      const retries = this.relayRetries.get(url) || 0;
      progress += `${chalk.gray.italic("error")} [${retries} retries]`;
    }
    console.log(progress);
  }
}
