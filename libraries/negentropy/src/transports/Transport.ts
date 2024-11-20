export interface Transport {
  send(message: string): void;
  onMessage(callback: (message: string) => void): void;
}