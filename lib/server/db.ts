import "server-only";

import { MongoClient, type Collection, type Db } from "mongodb";

export type SlotDoc = {
  _id: string; // client-supplied slot id
  provider: string;
  start: Date;
  end: Date;
  // Original timestamps, returned as received.
  start_text: string;
  end_text: string;
};

export type BookingDoc = {
  _id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: Date;
  cancelled_at?: Date;
};

export type IdempotencyDoc = {
  _id: string; // Idempotency-Key
  request_hash: string;
  state: "pending" | "done";
  response?: { status: number; body: unknown };
  created_at: Date;
};

export type RateLimitDoc = {
  _id: string; // normalised email
  hits: Date[];
  expires_at: Date;
};

export type Collections = {
  slots: Collection<SlotDoc>;
  bookings: Collection<BookingDoc>;
  idempotency: Collection<IdempotencyDoc>;
  rateLimits: Collection<RateLimitDoc>;
};

// Cached on globalThis: one client per serverless instance, and no extra
// connections on dev hot reloads.
const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoIndexes?: Promise<void>;
};

function clientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  globalForMongo._mongoClient ??= new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
  })
    .connect()
    .catch((err) => {
      globalForMongo._mongoClient = undefined;
      throw err;
    });
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(process.env.MONGODB_DB ?? "clinic");
}

async function ensureIndexes(db: Db) {
  globalForMongo._mongoIndexes ??= (async () => {
    const bookings = db.collection<BookingDoc>("bookings");
    await Promise.all([
      db.collection<SlotDoc>("slots").createIndex({ start: 1 }),
      db.collection<SlotDoc>("slots").createIndex({ provider: 1, start: 1 }),
      // At most one confirmed booking per slot. Partial, so cancelled
      // bookings don't block the slot from being booked again.
      bookings.createIndex(
        { slot_id: 1 },
        { name: "one_confirmed_booking_per_slot", unique: true, partialFilterExpression: { status: "confirmed" } },
      ),
      bookings.createIndex({ email: 1, created_at: 1, _id: 1 }),
      db.collection<IdempotencyDoc>("idempotency_keys").createIndex({ created_at: 1 }, { expireAfterSeconds: 86_400 }),
      db.collection<RateLimitDoc>("rate_limits").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ]);
  })().catch((err) => {
    globalForMongo._mongoIndexes = undefined;
    throw err;
  });
  return globalForMongo._mongoIndexes;
}

export async function collections(): Promise<Collections> {
  const db = await getDb();
  await ensureIndexes(db);
  return {
    slots: db.collection<SlotDoc>("slots"),
    bookings: db.collection<BookingDoc>("bookings"),
    idempotency: db.collection<IdempotencyDoc>("idempotency_keys"),
    rateLimits: db.collection<RateLimitDoc>("rate_limits"),
  };
}
