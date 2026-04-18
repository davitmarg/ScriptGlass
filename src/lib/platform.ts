
export const isElectron = () => {
  // @ts-ignore
  return typeof window !== 'undefined' && window.process && window.process.versions && window.process.versions.electron;
};

export const getPlatform = () => {
  if (isElectron()) return 'electron';
  return import.meta.env.VITE_PLATFORM || 'web';
};

export const isDesktop = () => getPlatform() === 'electron';

/**
 * Interface for API calls that can be switched between Web (fetch) and Electron (IPC)
 */
export async function apiCall(endpoint: string, options: any = {}) {
  const platform = getPlatform();

  if (platform === 'electron') {
    const electron = (window as any).electronAPI;
    if (electron && electron.invoke) {
      // For dynamic routes (containing /workspace/), we send them to a generic handler
      // and provide the full URL as well
      const data = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : (options.params || {});
      
      // If endpoint contains specific patterns, we can route it
      let channel = endpoint;
      if (endpoint.includes('/workspace/') && endpoint.includes('/files')) {
        channel = '/api/workspace/files';
      } else if (endpoint.includes('/workspace/') && endpoint.includes('/git/')) {
        channel = '/api/workspace/git';
      }

      return await electron.invoke(channel, { ...data, endpoint, method: options.method });
    }
  }

  // Fallback to fetch (Web or Dev Electron with Express server)
  const baseUrl = ''; // In development/web, it's relative to current host
  const { body, method = 'GET', headers = {} } = options;
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }
    throw new Error(errorJson.error || errorJson.message || `HTTP error! status: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}
