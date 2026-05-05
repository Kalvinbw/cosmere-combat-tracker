export async function fetchAdversaries() {
  const r = await fetch('/api/adversaries');
  return r.json();
}

export async function fetchBenchmarks() {
  const r = await fetch('/api/benchmarks');
  return r.json();
}

export async function fetchConfig() {
  const r = await fetch('/api/config');
  return r.json();
}

export async function postAdversary(payload, headers) {
  return fetch('/api/adversaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}
