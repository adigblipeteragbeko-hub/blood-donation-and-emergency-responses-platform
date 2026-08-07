import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import { AssistantIntentService } from './assistant-intent.service';
import { AssistantKnowledgeService } from './assistant-knowledge.service';
import { AssistantNavigationService, NavigationAction } from './assistant-navigation.service';
import { AssistantQueryService } from './assistant-query.service';

type AssistantResponseType = 'ANSWER' | 'NAVIGATION' | 'CLARIFICATION' | 'EMPTY_STATE' | 'ESCALATION' | 'FORBIDDEN' | 'UNSUPPORTED';
type AssistantUser = { id: string; role: Role };

const unsupportedMessage =
  "I'm here to help with blood donation and the BloodSOS platform. Please ask about eligibility, appointments, hospitals, emergency requests, inventory, AI recommendations, or using the system.";

const unclearMessage =
  'I could not fully match that question. I can help with inventory, appointments, requests, donor search, clinical reviews, Stock Intelligence, AI recommendations, or page navigation.';

const retrievalFailureMessage =
  'I could not retrieve that information right now. Please try again or open the related page.';

const medicalSafetyMessage =
  'This assistant cannot diagnose, prescribe treatment, approve donors, or provide emergency medical care. Contact the nearest hospital or emergency service immediately for urgent medical concerns.';

@Injectable()
export class AssistantService {
  constructor(
    private readonly config: ConfigService,
    private readonly intentService: AssistantIntentService,
    private readonly knowledge: AssistantKnowledgeService,
    private readonly navigation: AssistantNavigationService,
    private readonly query: AssistantQueryService,
    private readonly audit: AuditService,
  ) {}

  health() {
    return {
      enabled: this.config.get<boolean>('assistant.enabled', true),
      publicEnabled: this.config.get<boolean>('assistant.publicEnabled', true),
      mode: 'DETERMINISTIC_V1',
      externalModelEnabled: false,
    };
  }

  suggestions(user?: AssistantUser) {
    const role = this.navigation.roleKey(user?.role);
    const suggestedQuestions: Record<typeof role, string[]> = {
      PUBLIC: ['How do I become a donor?', 'Is blood donation safe?', 'How do I find a hospital?', 'How does BloodSOS work?', 'How do emergency requests work?'],
      DONOR: ['What is my eligibility status?', 'When is my next appointment?', 'Show my donation history.', 'Open my health form.', 'Show my notifications.'],
      HOSPITAL_ADMIN: [
        'Which blood groups are critical?',
        'Show my hospital\'s current stock.',
        'Show today\'s appointments.',
        'Show open emergency requests.',
        'How many approved donors are available?',
        'Show expiring blood units.',
        'Explain the current AI recommendation.',
        'Open Inventory.',
        'Open Stock Intelligence.',
        'Open Donor Search.',
        'Open Clinical Reviews.',
        'What happens when I cannot fulfil a request?',
        'How do donor mobilisation campaigns work?',
      ],
      ADMIN: ['Which hospitals require attention?', 'Show system-wide critical blood groups.', 'Open AI Intelligence.', 'Open Donor Communications.', 'Show recent audit activity.'],
    };
    return {
      role,
      suggestedQuestions: suggestedQuestions[role],
      quickActions: this.navigation.getQuickActions(user?.role),
      categories: this.knowledge.categories(role),
    };
  }

  async clear(user?: AssistantUser) {
    return {
      conversationId: this.createConversationId(user),
      intent: 'CLEAR_CONVERSATION',
      type: 'ANSWER' as AssistantResponseType,
      message: 'Conversation cleared for this session.',
      data: {},
      suggestions: this.buildSuggestions(user?.role),
      limitations: ['BloodSOS Assistant does not persist full chat transcripts in Version 1.'],
      timestamp: new Date().toISOString(),
    };
  }

  async publicMessage(dto: AssistantMessageDto) {
    const detected = this.intentService.detect(dto.message);
    if (this.isPrivateIntent(detected.intent)) {
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'FORBIDDEN',
        message: 'Please sign in with the appropriate account to access private BloodSOS information.',
        action: { label: 'Login', route: '/login' },
        role: undefined,
      });
    }
    return this.answerMessage(dto, undefined);
  }

  async privateMessage(dto: AssistantMessageDto, user: AssistantUser) {
    return this.answerMessage(dto, user);
  }

  private async answerMessage(dto: AssistantMessageDto, user?: AssistantUser) {
    const detected = this.intentService.detect(dto.message);
    const role = this.navigation.roleKey(user?.role);
    const bloodGroup = detected.bloodGroup ?? dto.context?.bloodGroup;

    if (detected.intent === 'UNSUPPORTED_TOPIC') {
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'UNSUPPORTED',
        message: /diagnose|treatment|medicine|symptom|emergency/i.test(dto.message) ? medicalSafetyMessage : unsupportedMessage,
        role: user?.role,
        limitations: ['The assistant is limited to BloodSOS and blood-donation platform support; it is not a general-purpose chatbot.'],
      });
    }

    if (detected.intent === 'GREETING' || detected.intent === 'HELP') {
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'ANSWER',
        message: role === 'HOSPITAL_ADMIN'
          ? 'BloodSOS Assistant helps Hospital Admins retrieve hospital-scoped operational information and open relevant platform pages. It can answer supported questions about inventory, appointments, emergency requests, donors, clinical reviews, alerts, Stock Intelligence and AI recommendations.'
          : 'Hello, I am BloodSOS Assistant. I can help with blood donation guidance, platform navigation, appointments, requests, inventory, notifications, and role-authorised operational summaries.',
        role: user?.role,
      });
    }

    if (detected.intent === 'CLARIFY_REQUESTS') {
      const actions = this.navigation.getAllowlist(user?.role).filter((action) => /Request/.test(action.label));
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'CLARIFICATION',
        message: 'Do you want to view active emergency requests or request history?',
        role: user?.role,
        suggestions: actions.map((action) => ({ label: action.label, actionType: 'NAVIGATE', route: action.route })),
      });
    }

    const navAction = this.navigation.actionForIntent(detected.intent, user?.role);
    if (navAction) {
      if (!this.navigation.isAllowed(navAction.route, user?.role)) {
        await this.auditForbidden(user, detected.intent);
        return this.response({
          conversationId: dto.conversationId,
          intent: detected.intent,
          type: 'FORBIDDEN',
          message: 'That page is not available for your current role.',
          role: user?.role,
        });
      }
      await this.auditNavigation(user, detected.intent, navAction);
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'NAVIGATION',
        message: `Opening ${navAction.label}.`,
        action: navAction,
        role: user?.role,
      });
    }

    if (this.isPrivateIntent(detected.intent)) {
      if (!user) throw new ForbiddenException('Please sign in to use this assistant capability.');
      let operational: Awaited<ReturnType<AssistantQueryService['answerOperational']>> = null;
      try {
        operational = await this.query.answerOperational(detected.intent, user, bloodGroup);
        this.logDiagnostic(detected, user?.role, operational?.type ?? 'EMPTY_STATE', true);
      } catch {
        this.logDiagnostic(detected, user?.role, 'ESCALATION', false);
        return this.response({
          conversationId: dto.conversationId,
          intent: detected.intent,
          type: 'ESCALATION',
          message: retrievalFailureMessage,
          action: this.navigation.getQuickActions(user.role)[0],
          role: user.role,
        });
      }
      if (operational) {
        await this.auditOperational(user, detected.intent);
        const action = operational.route ? { label: this.routeLabel(operational.route), route: operational.route } : undefined;
        return this.response({
          conversationId: dto.conversationId,
          intent: detected.intent,
          type: operational.type,
          message: operational.message,
          data: operational.data,
          action,
          role: user.role,
          limitations: ['Operational summaries are advisory. Authorised staff remain responsible for final decisions.'],
        });
      }
    }

    const knowledgeEntry = this.knowledge.findAnswer(dto.message, role);
    if (knowledgeEntry) {
      const action = knowledgeEntry.relatedRoute && this.navigation.isAllowed(knowledgeEntry.relatedRoute, user?.role)
        ? { label: `Open ${knowledgeEntry.title}`, route: knowledgeEntry.relatedRoute }
        : undefined;
      return this.response({
        conversationId: dto.conversationId,
        intent: detected.intent,
        type: 'ANSWER',
        message: knowledgeEntry.answer,
        data: { title: knowledgeEntry.title, category: knowledgeEntry.category },
        action,
        role: user?.role,
        limitations: knowledgeEntry.safetyNotice ? [knowledgeEntry.safetyNotice] : [],
      });
    }

    return this.response({
      conversationId: dto.conversationId,
      intent: 'UNSUPPORTED_TOPIC',
      type: 'CLARIFICATION',
      message: unclearMessage,
      role: user?.role,
    });
  }

  private response(args: {
    conversationId?: string;
    intent: string;
    type: AssistantResponseType;
    message: string;
    data?: unknown;
    action?: NavigationAction;
    suggestions?: Array<{ label: string; actionType: string; route?: string }>;
    limitations?: string[];
    role?: Role;
  }) {
    return {
      id: randomUUID(),
      conversationId: args.conversationId || this.createConversationId(args.role ? { id: 'authenticated', role: args.role } : undefined),
      intent: args.intent,
      type: args.type,
      message: args.message,
      data: args.data ?? {},
      action: args.action ? { label: args.action.label, route: args.action.route } : undefined,
      suggestions: args.suggestions ?? this.buildSuggestions(args.role),
      limitations: args.limitations ?? [],
      timestamp: new Date().toISOString(),
    };
  }

  private buildSuggestions(role?: Role) {
    return this.navigation.getQuickActions(role).map((action) => ({
      label: action.label,
      actionType: 'NAVIGATE',
      route: action.route,
    }));
  }

  private createConversationId(user?: { id: string; role: Role }) {
    return `${user?.role ?? 'PUBLIC'}-${randomUUID()}`;
  }

  private isPrivateIntent(intent: string) {
    return /^(DONOR_|HOSPITAL_|ADMIN_)/.test(intent);
  }

  private routeLabel(route: string) {
    return this.navigation.getAllowlist(Role.ADMIN).concat(this.navigation.getAllowlist(Role.HOSPITAL_ADMIN), this.navigation.getAllowlist(Role.DONOR))
      .find((action) => action.route === route)?.label ?? 'Open Related Page';
  }

  private async auditOperational(user: AssistantUser, intent: string) {
    await this.audit.log('ASSISTANT_OPERATIONAL_QUERY', 'ASSISTANT', user.id, undefined, { intent }, 'Assistant operational query answered.', { module: 'ASSISTANT' });
  }

  private async auditNavigation(user: AssistantUser | undefined, intent: string, action: NavigationAction) {
    if (!user) return;
    await this.audit.log('ASSISTANT_NAVIGATION_USED', 'ASSISTANT', user.id, undefined, { intent, route: action.route }, 'Assistant navigation action prepared.', { module: 'ASSISTANT' });
  }

  private async auditForbidden(user: AssistantUser | undefined, intent: string) {
    if (!user) return;
    await this.audit.log('ASSISTANT_FORBIDDEN_QUERY', 'ASSISTANT', user.id, undefined, { intent }, 'Assistant blocked a forbidden request.', { module: 'ASSISTANT' });
  }

  private logDiagnostic(detected: { intent: string; matchedGroup: string }, role: Role | undefined, responseType: string, querySucceeded: boolean) {
    if (this.config.get<string>('app.env') !== 'development') return;
    // Safe metadata only: no raw message content or clinical details.
    // eslint-disable-next-line no-console
    console.debug('BLOODSOS_ASSISTANT_DIAGNOSTIC', {
      normalizedIntent: detected.intent,
      matchedPhraseGroup: detected.matchedGroup,
      userRole: role ?? 'PUBLIC',
      responseType,
      querySucceeded,
    });
  }
}
