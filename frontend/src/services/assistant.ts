import api from './api';

export type AssistantResponseType = 'ANSWER' | 'NAVIGATION' | 'CLARIFICATION' | 'EMPTY_STATE' | 'ESCALATION' | 'FORBIDDEN' | 'UNSUPPORTED';

export type AssistantAction = {
  label: string;
  route: string;
};

export type AssistantResponse = {
  id: string;
  conversationId: string;
  intent: string;
  type: AssistantResponseType;
  message: string;
  data: Record<string, unknown>;
  action?: AssistantAction;
  suggestions: Array<{ label: string; actionType: string; route?: string }>;
  limitations: string[];
  timestamp: string;
};

export type AssistantSuggestions = {
  role: 'PUBLIC' | 'DONOR' | 'HOSPITAL_ADMIN' | 'ADMIN';
  suggestedQuestions: string[];
  quickActions: AssistantAction[];
  categories: string[];
};

type ApiEnvelope<T> = { success?: boolean; data?: T };

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload && 'success' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

export async function getAssistantSuggestions(isPublic: boolean) {
  const response = await api.get(isPublic ? '/assistant/public/suggestions' : '/assistant/suggestions');
  return unwrap<AssistantSuggestions>(response.data);
}

export async function sendAssistantMessage(payload: {
  message: string;
  conversationId?: string;
  context?: Record<string, unknown>;
  isPublic: boolean;
}) {
  const response = await api.post(payload.isPublic ? '/assistant/public/message' : '/assistant/message', {
    message: payload.message,
    conversationId: payload.conversationId,
    context: payload.context,
  });
  return unwrap<AssistantResponse>(response.data);
}

export async function clearAssistantConversation() {
  const response = await api.post('/assistant/clear');
  return unwrap<AssistantResponse>(response.data);
}
