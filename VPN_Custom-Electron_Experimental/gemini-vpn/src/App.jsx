import React, { useState, useEffect } from 'react';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [server, setServer] = useState('vpnbook-us178-udp53'); // Hardcoded for now
  const [ipAddress, setIpAddress] = useState('Not Connected');
  const [connectionTime, setConnectionTime] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Disconnected'); // New state for detailed messages

  // Effect for connection timer
  useEffect(() => {
    let timer;
    if (isConnected) {
      timer = setInterval(() => {
        setConnectionTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timer);
      setConnectionTime(0);
    }
    return () => clearInterval(timer);
  }, [isConnected]);

  // Effect to listen for VPN status from main process
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.on('vpn-status', (status) => {
        console.log('Received VPN status:', status);
        setIsConnected(status.connected);
        setStatusMessage(status.status);
        if (status.ip) {
          setIpAddress(status.ip);
        }
        if (status.server) {
          setServer(status.server);
        }
      });
    }
  }, []);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
      .map((v) => (v < 10 ? '0' + v : v))
      .filter((v, i) => v !== '00' || i > 0)
      .join(':');
  };

  const handleConnectToggle = () => {
    if (window.electronAPI) {
      if (isConnected) {
        setStatusMessage('Disconnecting...');
        window.electronAPI.send('vpn-disconnect');
      } else {
        setStatusMessage('Connecting...');
        window.electronAPI.send('vpn-connect', server);
      }
    } else {
      console.error('electronAPI is not available');
      setStatusMessage('Error: Electron API not available.');
    }
  };

  // Only one server option for now, based on the downloaded config
  const servers = [
    'vpnbook-us178-udp53',
  ];

  return (
    <div className="vpn-app">
      <header>
        <h1>Gemini VPN</h1>
      </header>
      <main>
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <p>{statusMessage}</p>
        </div>

        <div className="server-selection">
          <label htmlFor="server-select">Server Location:</label>
          <select
            id="server-select"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            disabled={isConnected || statusMessage === 'connecting' || statusMessage === 'disconnecting'}
          >
            {servers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          className={`connect-button ${isConnected ? 'disconnect' : 'connect'}`}
          onClick={handleConnectToggle}
          disabled={statusMessage === 'connecting' || statusMessage === 'disconnecting'}
        >
          {statusMessage === 'connecting' || statusMessage === 'disconnecting' ? '...' : (isConnected ? 'Disconnect' : 'Connect')}
        </button>

        <div className="details">
          <p>IP Address: {ipAddress}</p>
          <p>Time Connected: {formatTime(connectionTime)}</p>
        </div>
      </main>
    </div>
  );
}

export default App;
