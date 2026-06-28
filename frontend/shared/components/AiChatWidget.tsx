import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { useAuth } from '@app/providers/AuthContext';
import { aiChatService, type AiChatMessage } from '@services/aiChatService';
import { getErrorMessage } from '@services/serviceError';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

let messageSequence = 0;
const nextMessageId = () => `msg-${++messageSequence}`;

const QUICK_QUESTIONS = [
  'كم مندوب نشط؟',
  'مين أكثر واحد طلبات؟',
  'كم طلب اليوم؟',
  'مين إقامته بتنتهي؟',
  'حالة المركبات؟',
];

export function AiChatWidget() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setIsOpen(false);
    setMessages([]);
    setInput('');
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: (chatMessages: AiChatMessage[]) => aiChatService.sendMessage(chatMessages),
    onSuccess: (content) => {
      setMessages((prev) => [...prev, { id: nextMessageId(), role: 'assistant', content }]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: 'assistant', content: getErrorMessage(error) },
      ]);
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatMutation.isPending) return;
      const userMsg: Message = { id: nextMessageId(), role: 'user', content: trimmed };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
      chatMutation.mutate(
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      );
    },
    [messages, chatMutation],
  );

  if (!session) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 -2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-2xl shadow-card hover:shadow-card-hover hover:scale-105 transition-all duration-300 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 rounded-2xl"
          title="محادثة ذكية"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-[380px] h-[520px] bg-card -2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-2xl">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-bold">المساعد الذكي</p>
                <p className="text-[10px] text-white/70">مبني على بيانات النظام الحقيقية</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950 text-violet-600 flex items-center justify-center mx-auto">
                  <Bot size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">كيف أساعدك؟</p>
                  <p className="text-[11px] text-muted-foreground mt-1">اسألني عن أي شي في النظام</p>
                </div>
                <div className="space-y-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-start text-xs px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 text-foreground/80 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300' : 'bg-muted text-muted-foreground'}`}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-md' : 'bg-muted/50 text-foreground rounded-tl-md'}`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-muted-foreground" />
                </div>
                <div className="bg-muted/50 rounded-2xl rounded-tl-md px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border/50 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب سؤالك..."
                disabled={chatMutation.isPending}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatMutation.isPending}
                className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors"
              >
                {chatMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
