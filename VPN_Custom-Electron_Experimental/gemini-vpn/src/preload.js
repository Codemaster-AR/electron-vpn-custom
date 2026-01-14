const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    // List channels that can be sent to the main process
    let validSendChannels = ['vpn-connect', 'vpn-disconnect'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    // List channels that can be received from the main process
    let validReceiveChannels = ['vpn-status'];
    if (validReceiveChannels.includes(channel)) {
      // Deliberately strip event as it includes sender a
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});