/**
 * Error Type Tests
 *
 * Tests for error handling utilities and custom error classes.
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  isError,
  getErrorMessage,
  getErrorStack,
  formatError,
  RelayCheckError,
  ConfigError,
  DatabaseError,
  PublishError,
  isRelayCheckError,
  isConfigError,
  isDatabaseError,
  isPublishError
} from "../../src/types/errors.ts";

Deno.test("isError - returns true for Error instance", () => {
  const error = new Error("test error");
  assert(isError(error));
});

Deno.test("isError - returns false for non-Error values", () => {
  assert(!isError("string error"));
  assert(!isError(123));
  assert(!isError(null));
  assert(!isError(undefined));
  assert(!isError({ message: "not an error" }));
});

Deno.test("getErrorMessage - extracts message from Error", () => {
  const error = new Error("test message");
  assertEquals(getErrorMessage(error), "test message");
});

Deno.test("getErrorMessage - returns string error as-is", () => {
  assertEquals(getErrorMessage("string error"), "string error");
});

Deno.test("getErrorMessage - converts unknown to string", () => {
  assertEquals(getErrorMessage(123), "123");
  assertEquals(getErrorMessage(null), "null");
});

Deno.test("getErrorMessage - stringifies objects", () => {
  const obj = { code: 500, message: "server error" };
  const result = getErrorMessage(obj);
  assert(result.includes("500"));
  assert(result.includes("server error"));
});

Deno.test("getErrorStack - extracts stack from Error", () => {
  const error = new Error("test");
  const stack = getErrorStack(error);
  assertExists(stack);
  assert(stack!.includes("Error"));
});

Deno.test("getErrorStack - returns undefined for non-Error", () => {
  assertEquals(getErrorStack("string error"), undefined);
  assertEquals(getErrorStack(123), undefined);
});

Deno.test("formatError - formats error without context", () => {
  const error = new Error("test error");
  assertEquals(formatError(error), "test error");
});

Deno.test("formatError - formats error with context", () => {
  const error = new Error("test error");
  assertEquals(formatError(error, "Worker"), "[Worker] test error");
});

Deno.test("formatError - formats string error with context", () => {
  assertEquals(formatError("failed", "Database"), "[Database] failed");
});

Deno.test("RelayCheckError - creates with all fields", () => {
  const error = new RelayCheckError(
    "Connection failed",
    "wss://relay.example.com",
    "open",
    new Error("timeout")
  );

  assertEquals(error.message, "Connection failed");
  assertEquals(error.relayUrl, "wss://relay.example.com");
  assertEquals(error.checkType, "open");
  assertEquals(error.name, "RelayCheckError");
  assertExists(error.originalError);
});

Deno.test("RelayCheckError - creates with minimal fields", () => {
  const error = new RelayCheckError(
    "Check failed",
    "wss://relay.example.com"
  );

  assertEquals(error.message, "Check failed");
  assertEquals(error.relayUrl, "wss://relay.example.com");
  assertEquals(error.checkType, undefined);
  assertEquals(error.originalError, undefined);
});

Deno.test("ConfigError - creates with all fields", () => {
  const error = new ConfigError(
    "Invalid config",
    "monitor.slug",
    new Error("missing field")
  );

  assertEquals(error.message, "Invalid config");
  assertEquals(error.field, "monitor.slug");
  assertEquals(error.name, "ConfigError");
  assertExists(error.originalError);
});

Deno.test("DatabaseError - creates with operation", () => {
  const error = new DatabaseError(
    "Query failed",
    "INSERT",
    new Error("constraint violation")
  );

  assertEquals(error.message, "Query failed");
  assertEquals(error.operation, "INSERT");
  assertEquals(error.name, "DatabaseError");
  assertExists(error.originalError);
});

Deno.test("PublishError - creates with event details", () => {
  const error = new PublishError(
    "Publish failed",
    30166,
    "wss://relay.example.com",
    new Error("connection refused")
  );

  assertEquals(error.message, "Publish failed");
  assertEquals(error.eventKind, 30166);
  assertEquals(error.relayUrl, "wss://relay.example.com");
  assertEquals(error.name, "PublishError");
  assertExists(error.originalError);
});

Deno.test("isRelayCheckError - identifies RelayCheckError", () => {
  const error = new RelayCheckError("test", "wss://relay.example.com");
  assert(isRelayCheckError(error));
});

Deno.test("isRelayCheckError - rejects other errors", () => {
  assert(!isRelayCheckError(new Error("test")));
  assert(!isRelayCheckError(new ConfigError("test")));
  assert(!isRelayCheckError("not an error"));
});

Deno.test("isConfigError - identifies ConfigError", () => {
  const error = new ConfigError("test");
  assert(isConfigError(error));
});

Deno.test("isConfigError - rejects other errors", () => {
  assert(!isConfigError(new Error("test")));
  assert(!isConfigError(new RelayCheckError("test", "wss://relay.example.com")));
  assert(!isConfigError("not an error"));
});

Deno.test("isDatabaseError - identifies DatabaseError", () => {
  const error = new DatabaseError("test");
  assert(isDatabaseError(error));
});

Deno.test("isDatabaseError - rejects other errors", () => {
  assert(!isDatabaseError(new Error("test")));
  assert(!isDatabaseError(new ConfigError("test")));
  assert(!isDatabaseError("not an error"));
});

Deno.test("isPublishError - identifies PublishError", () => {
  const error = new PublishError("test");
  assert(isPublishError(error));
});

Deno.test("isPublishError - rejects other errors", () => {
  assert(!isPublishError(new Error("test")));
  assert(!isPublishError(new RelayCheckError("test", "wss://relay.example.com")));
  assert(!isPublishError("not an error"));
});

Deno.test("Custom errors are instanceof Error", () => {
  const relayError = new RelayCheckError("test", "wss://relay.example.com");
  const configError = new ConfigError("test");
  const dbError = new DatabaseError("test");
  const publishError = new PublishError("test");

  assert(relayError instanceof Error);
  assert(configError instanceof Error);
  assert(dbError instanceof Error);
  assert(publishError instanceof Error);
});

Deno.test("Custom errors work with isError type guard", () => {
  const relayError = new RelayCheckError("test", "wss://relay.example.com");
  const configError = new ConfigError("test");
  const dbError = new DatabaseError("test");
  const publishError = new PublishError("test");

  assert(isError(relayError));
  assert(isError(configError));
  assert(isError(dbError));
  assert(isError(publishError));
});
