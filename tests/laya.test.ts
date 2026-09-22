import { describe, expect, it, vi } from 'vitest';
import { LayaClient } from '../src/layaClient.js';
import { LayaSubprocessAsker } from '../src/layaBridge.js';
import { compact } from '../src/compact.js';
import type { Message } from '../src/types.js';

describe('LayaClient', () => {
  it('sends correct request payload to local Laya server', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          answers: {
            t1_call: { type: 'noul', noul: 0.9 },
            t1_result: { type: 'noul', noul: 0.1 },
          },
        }),
    });

    const client = new LayaClient({
      baseUrl: 'http://localhost:8000/v1/systemone',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const response = await client.ask('state text', {
      t1_call: { type: 'noul', instructions: 'keep call?' },
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/v1/systemone');
    expect(init.headers['authorization']).toBe('Bearer laya-local');
    expect(response.answers.t1_call.noul).toBe(0.9);
  });
});

describe('LayaSubprocessAsker', () => {
  it('executes python laya_bridge in mock mode and returns valid answers', async () => {
    const asker = new LayaSubprocessAsker({ useMock: true });
    const response = await asker.ask(
      { context: 'test context', goal: 'test goal', history: [] },
      { t1_call: { type: 'noul', instructions: 'is relevant?' } },
    );

    expect(response).toBeDefined();
    expect(response.answers).toBeDefined();
    expect(response.answers.t1_call).toBeDefined();
    expect(response.answers.t1_call.noul).toBe(0.75);
  });
});

describe('compact with LayaAsker', () => {
  it('compacts transcript messages using Laya mock asker', async () => {
    const asker = new LayaSubprocessAsker({ useMock: true });
    const messages: Message[] = [
      { role: 'user', text: 'Hello', toolUses: [] },
      {
        role: 'assistant',
        text: 'Let me run a command',
        toolUses: [
          {
            tool_use_id: 'call_1',
            tool: 'Bash',
            input: { command: 'ls -l' },
          },
        ],
      },
      {
        role: 'user',
        text: '',
        toolUses: [],
        toolResults: [
          {
            tool_use_id: 'call_1',
            text: 'file1.txt file2.txt file3.txt long content...',
          },
        ],
      },
      { role: 'assistant', text: 'Done', toolUses: [] },
    ];

    const result = await compact(messages, asker, {
      preserveRecentMessages: 0,
    });

    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.stats.calls).toBe(1);
  });
});
