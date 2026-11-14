// Spec conformance checks for docs/openapi.json (Levels 1–5), including the
// concurrency cases: 20 simultaneous bookings of one slot, 10 parallel
// retries with one Idempotency-Key, two simultaneous cancels, and a burst
// against the rate limit.
//
//   pnpm check:spec http://localhost:3000/api
//
// Warning: Calls POST /reset many times: it DELETES ALL BOOKINGS and slots on that
// server. Run `pnpm demo:slots` afterwards to reload demo slots.
// Needs API_KEY (read from .env.local by the pnpm script).

if (!process.argv[2]) {
  console.error("Usage: pnpm check:spec <api base url>   e.g. http://localhost:3000/api\n(This wipes all data on that server via POST /reset.)");
  process.exit(1);
}
const BASE = process.argv[2].replace(/\/$/, "");
const KEY = process.env.API_KEY;
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra !== "" ? "  — " + extra : ""}`); };
const section = (t) => console.log(`\n== ${t}`);
async function call(method, path, body, headers = {}) {
  const r = await fetch(BASE + path, { method, headers: { "X-API-Key": KEY, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json, headers: r.headers };
}
const isErr = (r) => r.json && Object.keys(r.json).join() === "error" && typeof r.json.error === "string";
const at = (h) => new Date(Date.now() + h * 3600e3).toISOString().replace(/\.\d+Z$/, "Z");
const slot = (id, h, provider = "Dr Ade") => ({ id, provider, start: at(h), end: at(h + 0.5) });
const reset = (slots) => call("POST", "/reset", { slots });
const book = (slot_id, email, name = "Ada Obi", headers) => call("POST", "/bookings", { slot_id, name, email }, headers);
const tally = (rs) => JSON.stringify(rs.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}));

section("Level 1 · core");
await reset([slot("s2", 48, "Dr Bello"), slot("s1", 24), { id: "past", provider: "Dr Ade", start: "2020-01-01T09:00:00Z", end: "2020-01-01T09:30:00Z" }]);
let r = await call("GET", "/slots");
check("GET /slots → every slot, earliest first", r.status === 200 && r.json.slots.map((s) => s.id).join() === "past,s1,s2");
check("slot keys exactly", r.json.slots.every((s) => Object.keys(s).sort().join() === "available,end,id,provider,start"));
check("start echoed exactly as sent", r.json.slots[0].start === "2020-01-01T09:00:00Z");
r = await call("GET", "/slots?provider=" + encodeURIComponent("Dr Bello"));
check("?provider exact match", r.json.slots.map((s) => s.id).join() === "s2");

section("Level 2 · API key on every request");
for (const [m, p, b] of [["GET", "/slots"], ["POST", "/reset", { slots: [] }], ["POST", "/bookings", {}], ["GET", "/bookings?email=a@b.co"], ["GET", "/bookings/x"], ["DELETE", "/bookings/x"]]) {
  const hdr = b ? { "content-type": "application/json" } : {};
  const none = await fetch(BASE + p, { method: m, headers: hdr, body: b ? JSON.stringify(b) : undefined });
  const wrong = await fetch(BASE + p, { method: m, headers: { ...hdr, "X-API-Key": "wrong" }, body: b ? JSON.stringify(b) : undefined });
  const nj = await none.json().catch(() => null);
  check(`${m} ${p}: missing key → 401, wrong key → 401`, none.status === 401 && wrong.status === 401 && typeof nj?.error === "string", `${none.status}/${wrong.status}`);
}
const lower = await fetch(BASE + "/slots", { headers: { "x-api-key": KEY } });
check("header name is case-insensitive", lower.status === 200);
r = await call("GET", "/slots");
check("slots survived the unauthorised /reset", r.json.slots.length === 3);

section("Level 2 · validation");
for (const [label, body] of [
  ["missing slot_id", { name: "A", email: "a@example.com" }], ["missing name", { slot_id: "s1", email: "a@example.com" }],
  ["missing email", { slot_id: "s1", name: "A" }], ["empty name", { slot_id: "s1", name: "", email: "a@example.com" }],
  ["whitespace name", { slot_id: "s1", name: "   ", email: "a@example.com" }], ["empty slot_id", { slot_id: "", name: "A", email: "a@example.com" }],
  ["invalid email", { slot_id: "s1", name: "A", email: "not-an-email" }], ["email wrong type", { slot_id: "s1", name: "A", email: 5 }],
]) { r = await call("POST", "/bookings", body); check(`${label} → 400 {error}`, r.status === 400 && isErr(r), `${r.status} ${JSON.stringify(r.json)}`); }
r = await call("POST", "/bookings", "not json");
check("non-JSON body → 400", r.status === 400 && isErr(r));
r = await book("nope", "a2@example.com");
check("unknown slot → 404", r.status === 404 && isErr(r), JSON.stringify(r.json));
r = await book("past", "b@example.com");
check("slot already started → 400", r.status === 400 && isErr(r), JSON.stringify(r.json));
r = await call("POST", "/bookings", { slot_id: "s1", name: "  Ada Obi  ", email: "  ADA@Example.COM  " });
check("trim name + lower-case email", r.status === 201 && r.json.name === "Ada Obi" && r.json.email === "ada@example.com", JSON.stringify(r.json));
check("booking keys exactly + status confirmed", Object.keys(r.json).sort().join() === "created_at,email,id,name,slot_id,status" && r.json.status === "confirmed");
const stored = await call("GET", "/bookings/" + r.json?.id);
check("GET /bookings/{id} returns it, stored normalised", stored.status === 200 && stored.json?.email === "ada@example.com" && stored.json?.name === "Ada Obi");
r = await call("GET", "/bookings/nope");
check("GET unknown id → 404", r.status === 404 && isErr(r));

section("Level 3 · no double booking under concurrency");
for (let run = 1; run <= 3; run++) {
  await reset([slot("race", 24)]);
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => book("race", `p${run}-${i}@example.com`, `Patient ${i}`)));
  const ok = rs.filter((x) => x.status === 201).length, conflicts = rs.filter((x) => x.status === 409 && isErr(x)).length;
  check(`run ${run}: 20 simultaneous → exactly one 201, nineteen 409`, ok === 1 && conflicts === 19, tally(rs));
}
r = await call("GET", "/slots");
check("slot shows available:false", r.json.slots[0].available === false);

section("Level 3 · cancellation");
await reset([slot("c1", 24)]);
const b1 = (await book("c1", "c@example.com")).json;
r = await call("DELETE", "/bookings/" + b1.id);
check("DELETE → 200 cancelled booking", r.status === 200 && r.json.status === "cancelled" && r.json.id === b1.id && Object.keys(r.json).sort().join() === "created_at,email,id,name,slot_id,status", JSON.stringify(r.json));
r = await call("GET", "/slots");
check("cancel frees the slot (available:true)", r.json.slots[0].available === true);
r = await call("GET", "/bookings/" + b1.id);
check("cancelled booking still readable (status change, not delete)", r.status === 200 && r.json.status === "cancelled");
r = await call("DELETE", "/bookings/" + b1.id);
check("DELETE again → 409", r.status === 409 && isErr(r), JSON.stringify(r.json));
r = await call("DELETE", "/bookings/does-not-exist");
check("DELETE unknown → 404", r.status === 404 && isErr(r));
r = await book("c1", "d@example.com");
check("cancelled slot can be booked again → 201", r.status === 201, String(r.status));
const both = await Promise.all([call("DELETE", "/bookings/" + r.json.id), call("DELETE", "/bookings/" + r.json.id)]);
const codes = both.map((x) => x.status).sort().join();
check("two cancels at once → one 200, one 409", codes === "200,409", codes);

section("Level 4 · idempotency");
await reset([slot("i1", 24), slot("i2", 48), slot("i3", 72)]);
const k1 = "key-" + Date.now();
const first = await book("i1", "idem@example.com", "Ada Obi", { "Idempotency-Key": k1 });
const again = await book("i1", "idem@example.com", "Ada Obi", { "Idempotency-Key": k1 });
check("same key + same body → same status + same id", first.status === 201 && again.status === 201 && first.json.id === again.json.id, `${first.status}/${again.status}`);
check("…and identical body", JSON.stringify(first.json) === JSON.stringify(again.json));
r = await call("GET", "/bookings?email=idem@example.com");
check("never creates a second booking", r.json.bookings.length === 1, String(r.json.bookings.length));
r = await book("i2", "idem@example.com", "Ada Obi", { "Idempotency-Key": k1 });
check("same key + different body → 422", r.status === 422 && isErr(r), `${r.status} ${JSON.stringify(r.json)}`);
const k2 = "par-" + Date.now();
const par = await Promise.all(Array.from({ length: 10 }, () => book("i3", "par@example.com", "Par", { "Idempotency-Key": k2 })));
check("10 parallel same key → all 201, one id", par.every((x) => x.status === 201) && new Set(par.map((x) => x.json.id)).size === 1, tally(par));
r = await call("GET", "/bookings?email=par@example.com");
check("…only one booking stored", r.json.bookings.length === 1);
const k3 = "fail-" + Date.now();
const f1 = await book("nope", "f@example.com", "F", { "Idempotency-Key": k3 });
const f2 = await book("nope", "f@example.com", "F", { "Idempotency-Key": k3 });
check("error responses replay too (404 → 404)", f1.status === 404 && f2.status === 404 && JSON.stringify(f1.json) === JSON.stringify(f2.json));
r = await book("i2", "nokey@example.com");
check("no key → normal booking", r.status === 201);

section("Level 4 · listing + cursor pagination");
await reset(Array.from({ length: 5 }, (_, i) => slot("l" + i, 24 + i)));
const made = [];
for (let i = 0; i < 5; i++) made.push((await book("l" + i, i % 2 ? "Page@Example.com" : "page@example.com", "P" + i)).json.id);
await book("l0", "other@example.com"); // 409, someone else
r = await call("GET", "/bookings?email=PAGE@EXAMPLE.COM");
check("email match ignores case; default limit returns all 5", r.status === 200 && r.json.bookings.length === 5 && r.json.next_cursor === null, `${r.json?.bookings?.length} next=${r.json?.next_cursor}`);
check("oldest first", r.json.bookings.map((b) => b.id).join() === made.join());
check("response keys {bookings, next_cursor}", Object.keys(r.json).sort().join() === "bookings,next_cursor");
const seen = []; let cursor = null, pages = 0;
do { r = await call("GET", `/bookings?email=page@example.com&limit=2${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`); seen.push(...r.json.bookings.map((b) => b.id)); cursor = r.json.next_cursor; pages++; } while (cursor && pages < 10);
check("limit=2 pages through all, no repeats/gaps, last next_cursor null", pages === 3 && seen.join() === made.join() && cursor === null, `pages=${pages}`);
for (const bad of ["0", "51", "abc", "1.5", "-1", ""]) { r = await call("GET", `/bookings?email=page@example.com&limit=${bad}`); check(`limit=${JSON.stringify(bad)} → 400`, r.status === 400 && isErr(r), String(r.status)); }
r = await call("GET", "/bookings?email=page@example.com&limit=50"); check("limit=50 ok", r.status === 200);
r = await call("GET", "/bookings?email=page@example.com&limit=1"); check("limit=1 → 1 item + a cursor", r.status === 200 && r.json.bookings.length === 1 && typeof r.json.next_cursor === "string");
r = await call("GET", "/bookings"); check("missing email → 400", r.status === 400 && isErr(r));
r = await call("GET", "/bookings?email=nobody@example.com"); check("unknown email → empty page", r.status === 200 && r.json.bookings.length === 0 && r.json.next_cursor === null);
r = await call("GET", "/bookings?email=page@example.com&cursor=garbage!!"); check("bad cursor → 400", r.status === 400);

section("Level 5 · rate limiting");
await reset([slot("r1", 24)]);
const attempts = [];
for (let i = 0; i < 5; i++) attempts.push(await book(i === 0 ? "r1" : "nope", "spam@example.com"));
check("5 attempts (1 ok + 4 failed) go through", attempts.every((x) => x.status !== 429), tally(attempts));
r = await book("nope", "spam@example.com");
const ra = r.headers.get("retry-after");
check("6th → 429 {error}", r.status === 429 && isErr(r), String(r.status));
check("Retry-After is whole seconds (1–60)", /^\d+$/.test(ra ?? "") && +ra >= 1 && +ra <= 60, String(ra));
r = await book("nope", "SPAM@example.com ");
check("same email with other case/spaces counts as the same person", r.status === 429);
r = await book("nope", "someone-else@example.com");
check("other emails are not affected", r.status === 404, String(r.status));
const burst = await Promise.all(Array.from({ length: 10 }, () => book("nope", "burst@example.com")));
check("10 parallel attempts → exactly 5 pass, 5 get 429", burst.filter((x) => x.status === 429).length === 5, tally(burst));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
