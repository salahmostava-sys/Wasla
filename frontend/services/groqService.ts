import { supabase } from '@services/supabase/client';
import { callServerFunction } from '@services/serverFunction';

let _configured: boolean | null = null;

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroqServer(messages: GroqMessage[]): Promise<string> {
  const response = await callServerFunction<{ message?: string; error?: string }>('groq-chat', { messages });

  if (response?.error) {
    throw new Error(response.error);
  }

  return response?.message ?? '';
}

export const groqService = {
  isConfigured: (): boolean => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return url?.startsWith('https') ?? false;
  },

  checkConfiguration: async (): Promise<boolean> => {
    if (_configured !== null) return _configured;
    try {
      await callServerFunction('groq-chat', {
        messages: [{ role: 'user', content: 'ping' }],
      });
      _configured = true;
    } catch {
      _configured = false;
    }
    return _configured;
  },

  chat: (message: string, systemPrompt?: string): Promise<string> => {
    const messages: GroqMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });
    return callGroqServer(messages);
  },

  chatMessages: (messages: GroqMessage[]): Promise<string> => {
    return callGroqServer(messages);
  },

  streamChat: async function* (messages: GroqMessage[]): AsyncGenerator<string, void, unknown> {
    const result = await callGroqServer(messages);
    yield result;
  },

  streamChatMessage: async function* (message: string, systemPrompt?: string): AsyncGenerator<string, void, unknown> {
    const messages: GroqMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });
    const result = await callGroqServer(messages);
    yield result;
  },
};
