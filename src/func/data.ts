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

type CaptureTheme = 'light' | 'dark';

interface CaptureResult {
  stored: { theme: CaptureTheme; key: string }[];
  // Present only on a partial failure, which the worker answers with a 502 and a
  // body worth reading: some themes may already have stored.
  failed?: { theme: CaptureTheme; key: string; existing: boolean };
  skipped?: CaptureTheme[];
  error?: string;
}

// Asks the worker to render a page and store it, rather than uploading bytes from
// here — the browser cannot screenshot a cross-origin site, so the rendering
// happens in Browser Run and only the resulting keys come back.
async function captureScreenshot(
  endpoint: string,
  apiKey: string,
  request: { url: string; key: string; themes: CaptureTheme[] }
): Promise<CaptureResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-API-Key': apiKey
    },
    body: JSON.stringify(request)
  });

  // A 502 is the one failure whose body has to be read rather than thrown away:
  // it names which themes stored before the failure, so discarding it would lose
  // an image that is already in a bucket nothing can delete from.
  if (response.status === 502) {
    return await response.json();
  }

  if (!response.ok) {
    // statusText is always empty over HTTP/2, which worker.askhb.no serves, so
    // on its own it renders as "Capture failed: 403 " with no reason at all.
    const detail = await response.text().catch(() => '');
    throw new Error(`Capture failed: ${response.status} ${detail || response.statusText || 'no response body'}`);
  }

  return await response.json();
}

export { fetchFromR2, fetchFromR2OrDefault, uploadFileToR2, captureScreenshot }
export type { CaptureTheme, CaptureResult }
