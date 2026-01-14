const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('child_process');
const ps = require('ps-node');

let openvpnProcess = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 400, // Adjusted width
    height: 600, // Adjusted height
    resizable: false, // Make it non-resizable
    title: 'Gemini VPN', // Set window title
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Recommended for security
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

      // Open the DevTools.

      mainWindow.webContents.openDevTools(); // Disabled for a cleaner app
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const VPN_CONFIG_PATH = path.join(app.getAppPath(), 'vpn_configs', 'vpnbook-openvpn-us178', 'vpnbook-us178-udp53.ovpn');
  const VPN_CREDENTIALS_PATH = path.join(app.getAppPath(), 'vpn_configs', 'credentials.txt');

  createWindow();

  // IPC Main handlers for real VPN actions
  ipcMain.on('vpn-connect', (event, server) => {
    if (openvpnProcess) {
      console.log('OpenVPN already running.');
      event.sender.send('vpn-status', { connected: true, ip: 'Already Connected', server: server });
      return;
    }

    console.log(`Attempting to connect to VPN for server: ${server} using config: ${VPN_CONFIG_PATH}`);
    event.sender.send('vpn-status', { status: 'connecting', server: server });

    // Spawn OpenVPN process
    openvpnProcess = spawn('sudo', [
      'openvpn',
      '--config', VPN_CONFIG_PATH,
      '--auth-user-pass', VPN_CREDENTIALS_PATH,
      '--pull-filter', 'ignore', 'redirect-gateway' // Prevent default route changes for testing
    ]);

    openvpnProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`OpenVPN stdout: ${output}`);
      if (output.includes('Initialization Sequence Completed')) {
        // Here we would ideally parse the real IP. For now, a placeholder.
        const fakeIp = `CONNECTED_IP_${Math.floor(Math.random() * 255)}`; 
        event.sender.send('vpn-status', { connected: true, status: 'connected', ip: fakeIp, server: server });
      }
      // You can add more detailed status parsing here
    });

    openvpnProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`OpenVPN stderr: ${output}`);
      event.sender.send('vpn-status', { status: 'error', message: output, server: server });
    });

    openvpnProcess.on('close', (code) => {
      console.log(`OpenVPN process exited with code ${code}`);
      openvpnProcess = null;
      event.sender.send('vpn-status', { connected: false, status: 'disconnected', ip: 'Not Connected', server: '' });
    });

    openvpnProcess.on('error', (err) => {
      console.error('Failed to start OpenVPN process:', err);
      openvpnProcess = null;
      event.sender.send('vpn-status', { connected: false, status: 'error', message: `Failed to start OpenVPN: ${err.message}`, server: '' });
    });
  });

  ipcMain.on('vpn-disconnect', (event) => {
    if (openvpnProcess) {
      console.log('Attempting to disconnect OpenVPN.');
      openvpnProcess.kill('SIGTERM'); // Send termination signal
      openvpnProcess = null;
      event.sender.send('vpn-status', { connected: false, status: 'disconnecting', ip: 'Not Connected', server: '' });
    } else {
      console.log('OpenVPN not running.');
      event.sender.send('vpn-status', { connected: false, status: 'disconnected', ip: 'Not Connected', server: '' });
    }
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // Ensure OpenVPN process is killed if app closes
  if (openvpnProcess) {
    openvpnProcess.kill('SIGTERM');
  }
});

