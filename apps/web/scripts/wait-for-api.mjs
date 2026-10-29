const url = process.env.RIBAT_API_HEALTH_URL ?? 'http://127.0.0.1:3000/api/v1/health/live';
const timeoutMs = Number(process.env.RIBAT_API_WAIT_MS ?? 120_000);
const deadline = Date.now() + timeoutMs;

while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.ok) process.exit(0);
  } catch {
    // API still starting (nest --watch compiles first).
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.error(`Timed out waiting for API at ${url}`);
process.exit(1);
