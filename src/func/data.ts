async function fetchFromR2<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function uploadToR2(data: unknown, endpoint: string) {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data, null, 2)
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  
  return response;
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

export { fetchFromR2, uploadToR2, uploadFileToR2 }