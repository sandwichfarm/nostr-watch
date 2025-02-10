// config.ts
import { parse } from "jsr:@std/yaml";

export interface Config {
  monitor: {
    slug: string;
    info: {
      name: string;
      about: string;
      nip05: string;
    };
    owner: string;
    geo: {
      city: string;
      country: string;
      countryCode: string;
      lat: number;
      lon: number;
      region: string;
      continent: string;
    };
  };
  publisher: {
    relays: string[];
  };
  relaymon: {
    networks: string[];
    retry: {
      expiry: { max: number; delay: number }[];
    };
    seed: {
      interval: number;  // in milliseconds
      sources: string[];
      options: {
        db?: {
          path: string;
        };
        static?: {
          path: string;
        };
        config?: string[];
      };
    };
    checks: {
      enabled: string[];
      options: {
        expires: number;
        interval: number;
        timeout: {
          open: number;
          read: number;
          [key: string]: number;
        };
        max: string;
      };
    };
  };
  queue: {
    workerConcurrency: number;
  };
}

export function parseDuration(input: number | string): number {
  if (typeof input === "number") return input;
  const trimmed = input.trim();
  const regex = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;
  const match = trimmed.match(regex);
  if (!match) {
    throw new Error(`Invalid duration format: ${input}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

function processConfigTimeValues(config: any): void {
  // Convert seed.interval.
  if (config.relaymon?.seed?.interval) {
    config.relaymon.seed.interval = parseDuration(config.relaymon.seed.interval);
  }
  // Convert checks.options.expires and interval.
  if (config.relaymon?.checks?.options) {
    if (config.relaymon.checks.options.expires) {
      config.relaymon.checks.options.expires = parseDuration(
        config.relaymon.checks.options.expires,
      );
    }
    if (config.relaymon.checks.options.interval) {
      config.relaymon.checks.options.interval = parseDuration(
        config.relaymon.checks.options.interval,
      );
    }
  }
  // Convert each retry expiry delay.
  if (Array.isArray(config.relaymon?.retry?.expiry)) {
    config.relaymon.retry.expiry = config.relaymon.retry.expiry.map(
      (entry: any) => ({
        ...entry,
        delay:
          typeof entry.delay === "string"
            ? parseDuration(entry.delay)
            : entry.delay,
      }),
    );
  }
}

export async function loadConfig(path: string): Promise<Config> {
  const fileText = await Deno.readTextFile(path);
  const config = parse(fileText);
  processConfigTimeValues(config);
  return config as Config;
}
