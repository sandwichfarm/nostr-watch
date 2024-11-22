// src/ServerHandler.test.ts

import { describe, it, expect, vi } from 'vitest';
import { NegentropyServer } from './ServerHandler';
import { RecordItem } from './types';

describe('NegentropyServer', () => {
  describe('handleMessage', () => {
    it('should handle NEG-OPEN message and send NEG-MSG response', async () => {
      // Arrange
      const records: RecordItem[] = []; // Provide test records
      const websocket = {
        send: vi.fn(),
        onmessage: null,
        onopen: null,
      };
      const server = new NegentropyServer(records, websocket as any);

      const subscriptionId = 'test-subscription';
      const filter = {};
      const initialMessageHex = '00'; // Provide a valid hex string

      const message = JSON.stringify(['NEG-OPEN', subscriptionId, filter, initialMessageHex]);

      // Act
      await server.handleMessage(message);

      // Assert
      expect(websocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
      expect(sentMessage[0]).toBe('NEG-MSG');
      expect(sentMessage[1]).toBe(subscriptionId);
      // Further assertions as needed
    });
  });
});
