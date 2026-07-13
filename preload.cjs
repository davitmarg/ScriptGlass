const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => {
    // White-list channels
    const validChannels = [
      'open-external-url',
      '/api/settings',
      '/api/workspace/open',
      '/api/browse',
      '/api/browse/select',
      '/api/terminal/exec',
      '/api/auth/github/url'
    ];
    
    // Check if channel starts with any valid prefix (for dynamic routes)
    const isPathMatch = channel.startsWith('/api/workspace/');
    
    if (validChannels.includes(channel) || isPathMatch) {
      return ipcRenderer.invoke(channel, data);
    }
    
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Method to start OAuth flow
  startGitHubAuth: (url) => {
    ipcRenderer.send('github-oauth-start', url);
  },
  
  // Method to listen for GitHub token
  onGitHubToken: (callback) => {
    const subscription = (event, token) => callback(token);
    ipcRenderer.on('github-oauth-token', subscription);
    return () => ipcRenderer.removeListener('github-oauth-token', subscription);
  }
});
