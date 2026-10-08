import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dictionaries } from "../src/lib/i18n";
import { ONLINE_WINDOW_MS, classPresenceFromLastSeen, platformPresence, presenceFromLastSeen, schoolPresenceMap } from "../src/lib/presence";

const now = new Date("2026-10-04T12:00:00.000Z").getTime();

test("ученик без отметки активности считается офлайн", () => {
  assert.equal(presenceFromLastSeen(null, now), "offline");
});

test("свежая отметка активности считается онлайном", () => {
  assert.equal(presenceFromLastSeen(new Date(now - 10_000), now), "online");
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS + 1).toISOString(), now), "online");
});

test("просроченная отметка активности считается офлайном", () => {
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS), now), "offline");
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS - 1), now), "offline");
});

test("class presence is based on the student's actual section, not the teacher's selected partner", () => {
  const seen = new Date(now - 10_000);
  assert.equal(classPresenceFromLastSeen(seen, null, now), "online");
  assert.equal(classPresenceFromLastSeen(seen, "class", now), "in_class");
  assert.equal(classPresenceFromLastSeen(seen, "board", now), "in_class");
  assert.equal(classPresenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS), "class", now), "offline");
  assert.equal(classPresenceFromLastSeen(null, "board", now), "offline");
  assert.equal(classPresenceFromLastSeen(seen, "unknown", now), "online");
});

test("class status collapses to online outside the class", () => {
  assert.equal(platformPresence("in_class"), "online");
  assert.equal(platformPresence("online"), "online");
  assert.equal(platformPresence("offline"), "offline");
});

test("school presence reflects routes, joins and leaves without a page reload", () => {
  assert.deepEqual(schoolPresenceMap([]), {});
  assert.deepEqual(schoolPresenceMap([{ clientId: "student", data: { inClass: false } }]), { student: "online" });
  assert.deepEqual(schoolPresenceMap([{ clientId: "student", data: { inClass: true } }]), { student: "in_class" });
  assert.deepEqual(schoolPresenceMap([{ clientId: "student", data: { inClass: false } }]), { student: "online" });
  assert.deepEqual(schoolPresenceMap([]), {});
});

test("multiple tabs/devices keep a student online and any class tab takes priority in either order", () => {
  const home = { clientId: "student", data: { inClass: false } };
  const classroom = { clientId: "student", data: { inClass: true } };
  assert.deepEqual(schoolPresenceMap([home, classroom]), { student: "in_class" });
  assert.deepEqual(schoolPresenceMap([classroom, home]), { student: "in_class" });
  assert.deepEqual(schoolPresenceMap([home, home]), { student: "online" });
  assert.deepEqual(schoolPresenceMap([home]), { student: "online" });
  assert.deepEqual(schoolPresenceMap([classroom]), { student: "in_class" });
});

test("old clients without location data remain online; missing identity and malformed location are ignored", () => {
  assert.deepEqual(schoolPresenceMap([
    { clientId: "legacy" },
    { clientId: "other", data: "class" },
    { clientId: "invalid", data: { inClass: "true" } },
    { data: { inClass: true } },
  ]), { legacy: "online", other: "online", invalid: "online" });
});

test("all locales have distinct class labels and generic indicators hide class status by default", () => {
  for (const dictionary of Object.values(dictionaries)) {
    assert.ok(dictionary.classRoom.inClass.trim());
    assert.ok(dictionary.classRoom.inClassTitle.trim());
    assert.notEqual(dictionary.classRoom.inClass, dictionary.classRoom.online);
  }
  const source = readFileSync("src/components/student-presence.tsx", "utf8");
  assert.ok(source.includes("showClassStatus = false"));
  assert.ok(source.includes('showClassStatus && presence === "in_class"'));
  assert.ok(source.includes('return platformPresence(presences[studentId] ?? "offline")'));
  assert.ok(source.includes('inClass ? "bg-violet-500" : online ? "bg-emerald-500" : "bg-rose-500"'));
});

test("class header and list consume the same live presence, including the summon button", () => {
  const source = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.ok(source.includes("presence: livePresences[partnerSnapshot.id] ?? partnerSnapshot.presence"));
  assert.ok(source.includes("presence: livePresences[person.id] ?? person.presence"));
  assert.equal((source.match(/<PresenceIndicator presence=\{(?:p|partner)\.presence\} showClassStatus/g) ?? []).length, 3);
  assert.ok(source.includes('disabled={busy || platformPresence(partner.presence) === "offline"}'));
});

test("route changes update presence member data without reconnecting and only observers read the membership list", () => {
  const realtime = readFileSync("src/lib/use-realtime.ts", "utf8");
  const source = readFileSync("src/components/student-presence.tsx", "utf8");
  assert.ok(realtime.includes("await channel.presence.update(presenceData())"));
  assert.ok(realtime.includes("}, [dataKey])"));
  assert.ok(realtime.includes("}, [configured, enabled, observesMembers])"));
  assert.ok(realtime.includes("if (!observesMembers) return true"));
  assert.ok(realtime.includes('status !== "unavailable"'));
  assert.ok(realtime.includes("window.setInterval(() => void recoverRef.current?.(), 15_000)"));
  assert.ok(source.includes('pathname === "/student/class" || pathname === "/teacher/class"'));
  assert.ok(source.includes('data: { role: "STUDENT", name, inClass }'));
});

test("a single throttled layout beacon keeps server online checks fresh without changing student content or class selection", () => {
  const source = readFileSync("src/lib/actions/presence.ts", "utf8");
  const action = source.slice(source.indexOf("export async function platformPresenceHeartbeatAction"), source.indexOf("export async function studentPresenceSnapshotAction"));
  assert.ok(action.includes("if (!session) return"));
  assert.ok(action.includes("now.getTime() - 20_000"));
  assert.ok(action.includes(".set({ lastSeenAt: now, classWhere })"));
  assert.ok(action.includes("eq(users.id, session.userId)"));
  assert.ok(!action.includes("classWithId"));
  assert.ok(!action.includes("classFocus"));
  assert.ok(action.includes("when ${users.classWhere} = 'board' then 'board'"));
});
