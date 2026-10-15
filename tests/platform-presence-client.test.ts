import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformPresenceWriter } from "../src/lib/platform-presence-client";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a slow in-class write finishes before the newer outside location, never after it", async () => {
  const requests: boolean[] = [];
  const completions: boolean[] = [];
  let release!: () => void;
  const writer = createPlatformPresenceWriter(async (location) => {
    requests.push(location);
    if (requests.length === 1) await new Promise<void>((resolve) => { release = resolve; });
    completions.push(location);
  });
  writer.location(true);
  writer.location(false);
  assert.deepEqual(requests, [true]);
  release();
  await tick();
  assert.deepEqual(completions, [true, false]);
  assert.deepEqual(requests, [true, false]);
});

test("rapid route changes coalesce to the newest location and no duplicate render writes are sent", async () => {
  const requests: boolean[] = [];
  let release!: () => void;
  const writer = createPlatformPresenceWriter(async (location) => {
    requests.push(location);
    if (requests.length === 1) await new Promise<void>((resolve) => { release = resolve; });
  });
  writer.location(false);
  writer.location(true);
  writer.location(false);
  writer.location(true);
  writer.location(true);
  release();
  await tick();
  assert.deepEqual(requests, [false, true]);
  writer.location(true);
  await tick();
  assert.equal(requests.length, 2);
});

test("transient failures retry the newest route, without retrying forever inside one request", async () => {
  const requests: boolean[] = [];
  let failing = true;
  const writer = createPlatformPresenceWriter(async (location) => {
    requests.push(location);
    if (failing) throw new Error("Offline");
  });
  writer.location(true);
  await tick();
  assert.deepEqual(requests, [true]);
  failing = false;
  writer.location(false);
  await tick();
  writer.retry();
  await tick();
  assert.deepEqual(requests, [true, false]);
  writer.heartbeat();
  await tick();
  assert.deepEqual(requests, [true, false, false]);
});

test("unmount cancels queued writes and old completions cannot restart the beacon", async () => {
  const requests: boolean[] = [];
  let release!: () => void;
  const writer = createPlatformPresenceWriter(async (location) => {
    requests.push(location);
    await new Promise<void>((resolve) => { release = resolve; });
  });
  writer.location(true);
  writer.location(false);
  writer.stop();
  release();
  await tick();
  writer.heartbeat();
  writer.retry();
  writer.location(false);
  assert.deepEqual(requests, [true]);
});
