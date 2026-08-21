async function fetchFromR2<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Returns `fallback` only when the object does not exist yet, so a bucket missing
// projects.json can still be edited into existence. Any other status — and any
// network-level rejection — propagates, because loading empty over content that is
// really there and then saving would destroy it, and R2 keeps no versions.
async function fetchFromR2OrDefault<T>(endpoint: string, fallback: T): Promise<T> {
  const response = await fetch(endpoint);
  if (response.status === 404) {
    return fallback;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function uploadFileToR2(file: File, endpoint: string, apiKey: string) {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Custom-API-Key': apiKey
    },
    body: file
  });

  if (!response.ok) {
    // statusText is always empty over HTTP/2, which worker.askhb.no serves, so
    // on its own it renders as "Upload failed: 403 " with no reason at all.
    const detail = await response.text().catch(() => '');
    throw new Error(`Upload failed: ${response.status} ${detail || response.statusText || 'no response body'}`);
  }

  return response;
}

export { fetchFromR2, fetchFromR2OrDefault, uploadFileToR2 }