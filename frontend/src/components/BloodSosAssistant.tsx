import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  AssistantResponse,
  AssistantSuggestions,
  clearAssistantConversation,
  getAssistantSuggestions,
  sendAssistantMessage,
} from '../services/assistant';

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
};

const roleRoutePrefix: Record<string, string> = {
  DONOR: '/donor',
  HOSPITAL_ADMIN: '/hospital',
  ADMIN: '/admin',
};

function isRouteAllowed(route: string, suggestions: AssistantSuggestions | null, role?: string) {
  if (!route.startsWith('/')) return false;
  if (route.startsWith('http://') || route.startsWith('https://') || route.startsWith('//')) return false;
  if (suggestions?.quickActions.some((action) => action.route === route)) return true;
  if (!role) return ['/', '/about', '/how-it-works', '/blood-eligibility', '/nearby-centers', '/donor-register', '/login', '/assistant', '/contact'].includes(route);
  return route.startsWith(roleRoutePrefix[role] ?? '/not-allowed');
}

export function BloodSosAssistant({ mode = 'full' }: { mode?: 'full' | 'compact' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPublic = !user;
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello, I am BloodSOS Assistant. Ask about blood donation, your account, appointments, hospitals, requests, inventory, or using the platform.',
    },
  ]);
  const [suggestions, setSuggestions] = useState<AssistantSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const hospitalIntro = user?.role === 'HOSPITAL_ADMIN'
    ? 'BloodSOS Assistant helps Hospital Admins retrieve hospital-scoped operational information and open relevant platform pages. It can answer supported questions about inventory, appointments, emergency requests, donors, clinical reviews, alerts, Stock Intelligence and AI recommendations.'
    : null;

  useEffect(() => {
    let mounted = true;
    getAssistantSuggestions(isPublic)
      .then((result) => {
        if (mounted) setSuggestions(result);
      })
      .catch(() => {
        if (mounted) setError('I could not load assistant suggestions right now.');
      });
    return () => {
      mounted = false;
    };
  }, [isPublic]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submitMessage = async (messageText = input.trim()) => {
    if (!messageText || loading) return;
    setInput('');
    setError('');
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: messageText };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const response = await sendAssistantMessage({ message: messageText, conversationId, isPublic });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, { id: response.id, sender: 'assistant', text: response.message, response }]);
    } catch {
      setError('I could not retrieve that information right now. Please try again or open the relevant page.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitMessage();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const clearConversation = async () => {
    setMessages([
      {
        id: 'welcome-cleared',
        sender: 'assistant',
        text: 'Conversation cleared. What would you like help with next?',
      },
    ]);
    setConversationId(undefined);
    setError('');
    if (!isPublic) {
      try {
        await clearAssistantConversation();
      } catch {
        // Local clear is enough for Version 1 because full transcripts are not persisted.
      }
    }
  };

  const handleNavigate = (route?: string) => {
    if (!route || !isRouteAllowed(route, suggestions, user?.role)) {
      setError('That page is not available for your current role.');
      return;
    }
    navigate(route);
  };

  return (
    <section className={`${mode === 'compact' ? 'h-full min-h-0' : 'card min-h-[620px]'} flex flex-col overflow-hidden`}>
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">BloodSOS Assistant</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              {hospitalIntro ?? 'Ask about blood donation, your account, appointments, hospitals, requests, inventory, and using the platform.'}
            </p>
          </div>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" onClick={() => void clearConversation()} type="button">
            Clear Conversation
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-0 flex-col">
          <div ref={listRef} aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message) => (
              <article key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.sender === 'user' ? 'ml-auto bg-primary text-white' : 'bg-white text-slate-800'}`}>
                <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                {message.response?.limitations?.length ? (
                  <ul className="mt-2 space-y-1 text-xs font-semibold opacity-80">
                    {message.response.limitations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
                {message.response?.action ? (
                  <button
                    className="mt-3 rounded-xl border border-primary bg-white px-3 py-2 text-xs font-black text-primary"
                    onClick={() => handleNavigate(message.response?.action?.route)}
                    type="button"
                  >
                    {message.response.action.label}
                  </button>
                ) : null}
                {message.response?.suggestions?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.response.suggestions.slice(0, 4).map((action) => (
                      <button
                        key={`${message.id}-${action.label}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                        onClick={() => action.route ? handleNavigate(action.route) : void submitMessage(action.label)}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {loading ? (
              <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-500" role="status">
                BloodSOS Assistant is checking safely...
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
              <button
                className="ml-3 underline"
                onClick={() => {
                  const userMessages = messages.filter((item) => item.sender === 'user');
                  void submitMessage(userMessages[userMessages.length - 1]?.text ?? '');
                }}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}

          <form className="border-t border-slate-200 bg-white p-4" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="assistant-message">Message BloodSOS Assistant</label>
            <div className="flex gap-2">
              <textarea
                id="assistant-message"
                className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-red-100"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about appointments, eligibility, requests, inventory, or navigation..."
                value={input}
              />
              <button className="btn-primary self-end px-5 py-3 disabled:opacity-60" disabled={loading || !input.trim()} type="submit">
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Press Enter to send. Use Shift+Enter for a new line.</p>
          </form>
        </div>

        <aside className="border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <h2 className="text-sm font-black uppercase tracking-wide text-primary">Suggested Questions</h2>
          <div className="mt-3 grid gap-2">
            {(suggestions?.suggestedQuestions ?? []).map((question) => (
              <button
                key={question}
                className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
                onClick={() => void submitMessage(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
          <h2 className="mt-5 text-sm font-black uppercase tracking-wide text-primary">Quick Actions</h2>
          <div className="mt-3 grid gap-2">
            {(suggestions?.quickActions ?? []).map((action) => (
              <button
                key={action.route}
                className="rounded-xl bg-red-50 px-3 py-2 text-left text-sm font-black text-primary transition hover:bg-red-100"
                onClick={() => handleNavigate(action.route)}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
