'use client';

import { useState, useRef, useEffect } from 'react';
import type { Assessment } from '@/lib/types';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Should I add a battery?',
  'What does capacity factor mean for my house?',
  'Is a loan or cash purchase better for me?',
  'How do I read my net metering bill?',
];

export default function AssessmentChat({ assessment }: { assessment: Assessment }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, assessment }),
      });
      const data = await res.json();
      if (data.reply) setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">AI Solar Advisor</span>
            <span className="ml-2 text-xs text-slate-400">Ask anything about your assessment</span>
          </div>
          <span className="ml-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Message thread */}
          <div className="px-4 pt-4 space-y-3 max-h-72 overflow-y-auto">
            {messages.length === 0 && (
              <div className="space-y-2 pb-2">
                <p className="text-xs text-slate-400">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-full transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-3 border-t border-slate-100 mt-2">
            <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything about your solar assessment…"
                className="flex-1 text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
