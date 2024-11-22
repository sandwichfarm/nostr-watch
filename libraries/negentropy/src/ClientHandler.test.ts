// src/ClientHandler.test.ts

import { describe, it, expect, vi } from 'vitest';
import { NegentropyClient } from './ClientHandler';
import { RecordItem } from './types';

describe('NegentropyClient', () => {
  describe('startSync', () => {
    it('should send NEG-OPEN message with initial message', async () => {
      // Arrange
      const records: RecordItem[] = []; // Provide test records
      const websocket = {
        send: vi.fn(),
        onmessage: null,
        onopen: null,
      };
      const filter = {};
      const subscriptionId = 'test-subscription';

      const client = new NegentropyClient(records, websocket as any, filter, subscriptionId);

      // Act
      await client.startSync();

      // Assert
      expect(websocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(websocket.send.mock.calls[0][0]);
      expect(sentMessage[0]).toBe('NEG-OPEN');
      expect(sentMessage[1]).toBe(subscriptionId);
      // Further assertions as needed
    });
  });

});
