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
      '/api/terminal/exec'
      // add more as needed
    ];
    
    // Check if channel starts with any valid prefix (for dynamic routes)
    const isPathMatch = channel.startsWith('/api/workspace/');
    
    if (validChannels.includes(channel) || isPathMatch) {
      return ipcRenderer.invoke(channel, data);
    }
    
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  }
});
