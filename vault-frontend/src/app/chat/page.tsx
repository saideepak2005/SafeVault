'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sendChatMessage } from '@/lib/api';
import Nav from '@/components/nav';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: Array<{ fileId: string; fileName: string; similarity: number }>;
  provider?: string | null;
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setSending(true);

    try {
      const data = await sendChatMessage(question);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources,
          provider: data.provider,
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Chat with your files</h1>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center mt-12">
              Ask a question about your uploaded documents.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white shadow border border-gray-100'
                }`}
              >
                {msg.text}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                    <span className="text-xs text-gray-500 font-medium">
                      Sources:
                    </span>
                    {msg.sources.map((s, j) => (
                      <div key={j} className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                        <span className="font-medium text-gray-700">
                          {s.fileName}
                        </span>
                        <span>
                          ({(s.similarity * 100).toFixed(1)}% match)
                        </span>
                      </div>
                    ))}
                    {msg.provider && (
                      <div className="text-xs text-gray-400 mt-1">
                        Answered by {msg.provider}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents…"
            disabled={sending}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {sending ? '…' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  );
}
