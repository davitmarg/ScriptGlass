
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
    // In Electron, we use IPC to talk to the main process
    // We assume contextBridge has exposed an 'electronAPI' or similar helper
    // If not, we fall back to window.require if not isolated
    const electron = (window as any).electronAPI;
    if (electron && electron.invoke) {
      return await electron.invoke(endpoint, options.body ? JSON.parse(options.body) : options.params);
    }
    
    // Fallback for non-isolated if allowed
    const ipcRenderer = (window as any).ipcRenderer;
    if (ipcRenderer) {
      return await ipcRenderer.invoke(endpoint, options.body ? JSON.parse(options.body) : options.params);
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
