import { callServerFunction } from '@services/serverFunction';
import { toServiceError } from '@services/serviceError';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type AiChatResponse = {
  message?: string;
  error?: string;
};

export const aiChatService = {
  sendMessage: async (messages: AiChatMessage[]): Promise<string> => {
    try {
      const data = await callServerFunction<AiChatResponse>('ai-chat', { messages });

      if (data?.error) {
        throw toServiceError(new Error(data.error), 'aiChatService.sendMessage');
      }

      return data?.message ?? 'لا يوجد رد';
    } catch (err) {
      if (err instanceof Error && err.message.includes('Not authenticated')) {
        throw toServiceError(err, 'aiChatService.sendMessage');
      }
      throw err;
    }
  },
};
