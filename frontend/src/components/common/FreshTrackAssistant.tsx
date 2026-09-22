import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { aiService } from '@/services/services';
import type { ChatMessage, ChatRecommendation } from '@/types';

const initialMessage = (role: 'donor' | 'ngo'): ChatMessage => ({
  role: 'assistant',
  content: role === 'donor'
    ? "Hi! I'm your FreshTrack Assistant. I can help you find NGOs for your donations, manage your donations and requests, and answer questions about FreshTrack."
    : "Hi! I'm your FreshTrack Assistant. I can help you find available food donations, manage your requests, and answer questions about FreshTrack.",
});

const QUICK_PROMPTS = {
  donor: [
    'Which NGOs near me can accept rice?',
    'Which NGOs can accept cooked food?',
    'How do I create a donation?',
  ],
  ngo: [
    'Find nearby available food.',
    'Show me nearby rice donations.',
    'How do I request a donation?',
  ],
} as const;

export default function FreshTrackAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recommendations, setRecommendations] = useState<Record<number, ChatRecommendation[]>>({});
  const [loading, setLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const storageKey = `freshtrack_ai_chat_${user.id}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try { setMessages(JSON.parse(stored)); } catch { setMessages([initialMessage(user.role)]); }
    } else {
      setMessages([initialMessage(user.role)]);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user || user.role === 'admin' || messages.length === 0) return;
    sessionStorage.setItem(`freshtrack_ai_chat_${user.id}`, JSON.stringify(messages.slice(-10)));
  }, [messages, user?.id, user?.role]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      restoreFocus();
    }
  }, [open]);

  if (!user || user.role === 'admin') return null;

  const sendMessage = async (message = input) => {
    const content = message.trim();
    if (!content || loading) return;

    const nextUserMessage: ChatMessage = { role: 'user', content };
    const history = messages.slice(-10);
    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiService.chat({ message: content, history });
      setMessages((current) => {
        const assistantIndex = current.length;
        setRecommendations((existing) => ({ ...existing, [assistantIndex]: response.recommendations || [] }));
        return [...current, { role: 'assistant', content: response.message }];
      });
    } catch {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: "Sorry, I couldn't process that request right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
      restoreFocus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <section className="mb-3 flex h-[min(32rem,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:w-96" aria-label="FreshTrack Assistant">
          <div className="flex items-center justify-between bg-primary-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h2 className="text-sm font-semibold">FreshTrack Assistant</h2>
                <p className="text-xs text-primary-100">Here to help with your food journey</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-primary-700" aria-label="Close assistant">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] ${message.role === 'user' ? 'rounded-br-sm bg-primary-600 text-white' : 'rounded-bl-sm border border-gray-200 bg-white text-gray-700'} rounded-xl px-3 py-2 text-sm`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.role === 'assistant' && recommendations[index]?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {recommendations[index].map((recommendation) => (
                        <RecommendationCard key={`${recommendation.type}-${recommendation.id}`} recommendation={recommendation} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="space-y-2 pt-1">
                <p className="px-1 text-xs font-medium text-gray-500">Try asking:</p>
                {QUICK_PROMPTS[user.role].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="block w-full rounded-lg border border-primary-100 bg-white px-3 py-2 text-left text-xs text-primary-700 hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50" disabled={loading}>
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            {loading && <p className="text-xs italic text-gray-500">FreshTrack is thinking...</p>}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="border-t border-gray-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask FreshTrack..."
                aria-label="Message FreshTrack Assistant"
                className="input min-h-10 resize-none px-3 py-2 text-sm"
                rows={1}
                disabled={loading}
              />
              <button type="button" onClick={() => void sendMessage()} disabled={loading || !input.trim()} className="btn-primary h-10 w-10 shrink-0 p-0" aria-label="Send message">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Enter to send, Shift+Enter for a new line</p>
          </div>
        </section>
      )}

      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700" aria-label="Open FreshTrack Assistant" title="Open FreshTrack Assistant">
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: ChatRecommendation }) {
  const isNgo = recommendation.type === 'ngo';
  const title = isNgo ? recommendation.organizationName || recommendation.name : recommendation.foodName;
  const detail = isNgo
    ? `${recommendation.distanceKm} km away`
    : `${recommendation.category} | ${recommendation.quantity} | ${recommendation.distanceKm} km away`;

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-700">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-600">{detail}</p>
      {isNgo ? (
        <>
          <p className="mt-2 text-xs">Accepts: {recommendation.acceptedCategories.join(', ') || 'Not specified'}</p>
          <p className="mt-1 text-xs">Location: {recommendation.location || 'Not specified'}</p>
          <p className="mt-1 text-xs">{recommendation.isAcceptingDonations ? 'Currently accepting donations' : 'Not currently accepting donations'}</p>
          {recommendation.currentNeedDescription && <p className="mt-1 text-xs">Need: {recommendation.currentNeedDescription}</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-xs">Pickup: {recommendation.location}</p>
          <p className="mt-1 text-xs">Available until: {new Date(recommendation.availableUntil).toLocaleString()}</p>
        </>
      )}
      {isNgo ? (
        <Link to={`/ngos/${recommendation.id}`} className="mt-3 inline-flex text-xs font-semibold text-primary-700 hover:text-primary-800">View NGO</Link>
      ) : (
        <Link to={`/food/${recommendation.id}`} className="mt-3 inline-flex text-xs font-semibold text-primary-700 hover:text-primary-800">
          View Donation
        </Link>
      )}
    </article>
  );
}
