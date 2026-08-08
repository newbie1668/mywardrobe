const API_ROOT = "/api/import/modeled-previews";

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Modeled Preview request failed (${response.status})`);
  return payload;
}

export function createModeledPreviewService() {
  return {
    start: (outfit) => request(API_ROOT, { method: "POST", body: JSON.stringify({ outfit }) }),
    read: (jobId) => request(`${API_ROOT}/${encodeURIComponent(jobId)}`),
    remove: (jobId) => request(`${API_ROOT}/${encodeURIComponent(jobId)}`, { method: "DELETE" }),
  };
}
