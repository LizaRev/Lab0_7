import { describe, expect, test } from 'vitest';

import {
  MESSAGE_TYPES,
  parseClientMessage,
} from './protocol.js';

describe('client protocol', () => {
  test('parseClientMessage accepts valid join message', () => {
    const result = parseClientMessage({
      version: 1,
      type: MESSAGE_TYPES.JOIN,
      roomId: 'alpha',
      name: 'Liza',
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.message.type).toBe(MESSAGE_TYPES.JOIN);

      if (result.message.type === MESSAGE_TYPES.JOIN) {
        expect(result.message.roomId).toBe('alpha');
        expect(result.message.name).toBe('Liza');
      }
    }
  });

  test('parseClientMessage rejects invalid message', () => {
    const result = parseClientMessage({
      version: 999,
      type: MESSAGE_TYPES.JOIN,
      roomId: 'alpha',
      name: 'Liza',
    });

    expect(result.ok).toBe(false);
  });

  test('parseClientMessage rejects unsupported server message', () => {
    const result = parseClientMessage({
      version: 1,
      type: MESSAGE_TYPES.ROSTER,
      roomId: 'alpha',
      players: [],
    });

    expect(result.ok).toBe(false);
  });
});