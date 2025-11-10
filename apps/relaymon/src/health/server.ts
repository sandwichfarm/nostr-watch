/**
 * Health HTTP server
 *
 * Provides HTTP endpoints for health checks and metrics using Deno.serve
 */

import { getLogger } from "../utils/logger.ts";
import { buildHealthSnapshot } from "./snapshot.ts";
import type { HealthServerConfig } from "./types.ts";
import type { HealthSnapshot } from "./types.ts";
import type { HeartbeatTracker } from "./types.ts";
import type { ErrorTracker } from "./snapshot.ts";
import type { QueueManager } from "../utils/queueManager.ts";

const logger = getLogger("HealthServer");

/**
 * Health server context
 */
export interface HealthServerContext {
  queueManager: QueueManager;
  privkey: string | undefined;
  heartbeat: HeartbeatTracker;
  errorTracker: ErrorTracker;
  authToken?: string;
  thresholds: {
    checkIdleMs: number;
    publishBacklogMax: number;
    errorRatePerMin: number;
    startupGraceMs: number;
  };
}

/**
 * Health server instance
 */
export class HealthServer {
  private server: Deno.HttpServer | null = null;
  private context: HealthServerContext;
  private config: HealthServerConfig;

  constructor(config: HealthServerConfig, context: HealthServerContext) {
    this.config = config;
    this.context = context;
  }

  /**
   * Start the health server
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Health server disabled");
      return;
    }

    const handler = (req: Request): Response | Promise<Response> => {
      return this.handleRequest(req);
    };

    try {
      this.server = Deno.serve({
        hostname: this.config.host,
        port: this.config.port,
        onListen: ({ hostname, port }) => {
          logger.info(`Health server listening on http://${hostname}:${port}`);
        },
      }, handler);

      // Wait for server to start
      await this.server.finished;
    } catch (error) {
      logger.error(`Health server error: ${error}`);
      throw error;
    }
  }

  /**
   * Stop the health server
   */
  async stop(): Promise<void> {
    if (this.server) {
      logger.info("Shutting down health server...");
      await this.server.shutdown();
      this.server = null;
      logger.info("Health server stopped");
    }
  }

  /**
   * Check authentication
   */
  private checkAuth(req: Request): boolean {
    if (!this.config.authEnabled) {
      return true;
    }

    if (!this.context.authToken) {
      logger.warn("Auth enabled but no token configured");
      return false;
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return false;
    }

    // Support "Bearer <token>" or just "<token>"
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    return token === this.context.authToken;
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Check authentication
    if (!this.checkAuth(req)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Route to appropriate handler
    switch (url.pathname) {
      case "/healthz":
      case "/health":
        return await this.handleHealthz();

      case "/metrics":
        return await this.handleMetrics();

      case "/":
        return this.handleRoot();

      default:
        return new Response(
          JSON.stringify({ error: "Not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
    }
  }

  /**
   * Handle /healthz endpoint
   *
   * Returns minimal health status
   * - 200 for "up" or "degraded"
   * - 503 for "down"
   */
  private async handleHealthz(): Promise<Response> {
    try {
      const snapshot = await buildHealthSnapshot({
        queueManager: this.context.queueManager,
        privkey: this.context.privkey,
        heartbeat: this.context.heartbeat,
        thresholds: this.context.thresholds,
        errorTracker: this.context.errorTracker,
      });

      const status = snapshot.state === "down" ? 503 : 200;

      const response = {
        status: snapshot.state,
        timestamp: snapshot.timestamp,
        uptime: snapshot.uptime,
        reasons: snapshot.reasons,
      };

      return new Response(
        JSON.stringify(response, null, 2),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      logger.error(`Error in /healthz: ${error}`);
      return new Response(
        JSON.stringify({
          status: "down",
          error: "Health check failed",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Handle /metrics endpoint
   *
   * Returns full health snapshot with all metrics
   */
  private async handleMetrics(): Promise<Response> {
    try {
      const snapshot = await buildHealthSnapshot({
        queueManager: this.context.queueManager,
        privkey: this.context.privkey,
        heartbeat: this.context.heartbeat,
        thresholds: this.context.thresholds,
        errorTracker: this.context.errorTracker,
      });

      return new Response(
        JSON.stringify(snapshot, null, 2),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      logger.error(`Error in /metrics: ${error}`);
      return new Response(
        JSON.stringify({
          error: "Failed to build health snapshot",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Handle / (root) endpoint
   *
   * Returns available endpoints
   */
  private handleRoot(): Response {
    const endpoints = {
      endpoints: [
        {
          path: "/healthz",
          description: "Health check endpoint (200 for up/degraded, 503 for down)",
        },
        {
          path: "/metrics",
          description: "Full health metrics and snapshot",
        },
      ],
      auth: this.config.authEnabled ? "required" : "disabled",
    };

    return new Response(
      JSON.stringify(endpoints, null, 2),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Create and start health server
 *
 * @param config - Health server configuration
 * @param context - Server context
 * @returns Health server instance
 */
export async function startHealthServer(
  config: HealthServerConfig,
  context: HealthServerContext,
): Promise<HealthServer> {
  const server = new HealthServer(config, context);
  // Don't await - let it run in background
  server.start().catch((error) => {
    logger.error(`Health server failed to start: ${error}`);
  });
  return server;
}
