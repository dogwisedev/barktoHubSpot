// lib/store.js
// Tiny Upstash Redis client over REST (no dependencies).
// Works with either env naming the Vercel/Upstash integration creates:
//   KV_REST_API_URL + KV_REST_API_TOKEN   or   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = () => !!(URL_ && TOKEN);

async function cmd(...args) {
  if (!configured()) throw new Error("Redis not configured: add Upstash Redis in Vercel → Storage");
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args.map(String))
  });
  const d = await r.json();
  if (d.error) throw new Error(`Redis: ${d.error}`);
  return d.result;
}

async function pipeline(commands) {
  if (!commands.length) return [];
  if (!configured()) throw new Error("Redis not configured");
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands.map(c => c.map(String)))
  });
  const d = await r.json();
  return d.map(x => { if (x.error) throw new Error(`Redis: ${x.error}`); return x.result; });
}

const parse = (v) => { try { return v == null ? null : JSON.parse(v); } catch { return null; } };

const store = {
  configured,
  cmd,
  pipeline,
  async getJSON(key) { return parse(await cmd("GET", key)); },
  async setJSON(key, value, ttlSec) {
    return ttlSec ? cmd("SET", key, JSON.stringify(value), "EX", ttlSec) : cmd("SET", key, JSON.stringify(value));
  },
  async mgetJSON(keys) { return keys.length ? (await cmd("MGET", ...keys)).map(parse) : []; },
  async setNX(key, value, ttlSec) { return (await cmd("SET", key, value, "NX", "EX", ttlSec)) === "OK"; },
  async del(key) { return cmd("DEL", key); },
  async pushLog(key, entry, max = 300) {
    await pipeline([["LPUSH", key, JSON.stringify(entry)], ["LTRIM", key, 0, max - 1]]);
  },
  async listJSON(key, n = 50) { return (await cmd("LRANGE", key, 0, n - 1)).map(parse); },
  async hincr(key, field, by, ttlSec) {
    await pipeline([["HINCRBY", key, field, Math.round(by)], ["EXPIRE", key, ttlSec]]);
  },
  async hgetall(key) {
    const arr = await cmd("HGETALL", key) || [];
    const o = {};
    for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]);
    return o;
  }
};

module.exports = store;
