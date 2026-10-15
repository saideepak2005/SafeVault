'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { sendChatMessage } from '@/lib/api';
import Nav from '@/components/nav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  Loader2,
} from 'lucide-react';

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
  }, [messages, sending]);

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
        {
          role: 'assistant',
          text: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading chat…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <Nav />

      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Document Assistant
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RAG Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ask questions directly grounded in your uploaded vault files.
            </p>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-[400px]">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                How can I help with your documents?
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                Query key dates, summarize contracts, locate receipts, or verify details across all your stored files.
              </p>

              {/* Sample prompts */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {[
                  'What are my upcoming renewal dates?',
                  'Summarize the key terms in my insurance policy',
                  'What recent expenses or bills were saved?',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setInput(sample)}
                    className="text-xs bg-white hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-600 border border-slate-200/80 hover:border-indigo-200 px-3 py-2 rounded-xl transition-all shadow-2xs text-left cursor-pointer"
                  >
                    &ldquo;{sample}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`flex gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Avatar */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed transition-all ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-sm shadow-indigo-600/10'
                      : 'bg-white border border-slate-200/80 rounded-tl-xs shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Sources referenced ({msg.sources.length}):</span>
                      </div>
                      <div className="flex flex-col gap-1.5 pt-1">
                        {msg.sources.map((s, j) => (
                          <div
                            key={j}
                            className="text-xs bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-slate-700 truncate">
                              {s.fileName}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                              {(s.similarity * 100).toFixed(1)}% match
                            </span>
                          </div>
                        ))}
                      </div>

                      {msg.provider && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Generated with {msg.provider}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing / Thinking Indicator */}
          {sending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">
                  Searching knowledge base…
                </span>
                <div className="flex items-center gap-1">
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Dock */}
        <div className="mt-4 pt-2">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your uploaded documents…"
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm shadow-indigo-600/20 cursor-pointer shrink-0"
              title="Send message"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </form>
          <p className="text-[11px] text-center text-slate-400 mt-2">
            Answers are synthesized strictly from indexed document chunks in your vault.
          </p>
        </div>
      </main>
    </div>
  );
}
