import WebSocket from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Creates a WebSocket connection over a SOCKS proxy (e.g., Tor).
 * @param onionSocket - The WebSocket URL (ws:// or wss://) of the .onion service.
 * @param socksProxy - The SOCKS proxy URL (e.g., socks5://127.0.0.1:9050).
 * @returns A WebSocket instance.
 */
export function TorWebSocket(onionSocket: string, socksProxy: string, timeout: number): WebSocket {
  const agent = new SocksProxyAgent(socksProxy, { timeout });
  return new WebSocket(onionSocket, { agent });
}
