import { Injectable } from '@nestjs/common';
import { BloodGroup } from '@prisma/client';

export type AssistantIntent =
  | 'GREETING' | 'HELP' | 'PLATFORM_OVERVIEW' | 'CONTACT_SUPPORT' | 'UNSUPPORTED_TOPIC' | 'CLARIFY_REQUESTS'
  | 'OPEN_DASHBOARD' | 'OPEN_INVENTORY' | 'OPEN_STOCK_INTELLIGENCE' | 'OPEN_AI_INTELLIGENCE' | 'OPEN_APPOINTMENTS'
  | 'OPEN_REQUESTS' | 'OPEN_CLINICAL_REVIEWS' | 'OPEN_DONOR_COMMUNICATIONS' | 'OPEN_NOTIFICATIONS' | 'OPEN_REPORTS'
  | 'OPEN_PROFILE' | 'OPEN_LIVE_MAP'
  | 'DONOR_ELIGIBILITY_STATUS' | 'DONOR_NEXT_APPOINTMENT' | 'DONOR_DONATION_HISTORY' | 'DONOR_NOTIFICATION_COUNT'
  | 'HOSPITAL_STOCK_STATUS' | 'HOSPITAL_CRITICAL_GROUPS' | 'HOSPITAL_OPEN_REQUESTS' | 'HOSPITAL_TODAY_APPOINTMENTS'
  | 'HOSPITAL_EXPIRING_UNITS' | 'HOSPITAL_AVAILABLE_DONORS' | 'HOSPITAL_AI_EXPLANATION' | 'HOSPITAL_RECENT_ALERTS'
  | 'ADMIN_HOSPITALS_REQUIRING_ATTENTION' | 'ADMIN_SYSTEM_CRITICAL_GROUPS' | 'ADMIN_OPEN_REQUESTS' | 'ADMIN_DONOR_TOTALS'
  | 'ADMIN_HOSPITAL_TOTALS' | 'ADMIN_AI_HISTORY' | 'ADMIN_RECENT_AUDIT_ACTIVITY' | 'FAQ';

export type DetectedIntent = {
  intent: AssistantIntent;
  bloodGroup?: BloodGroup;
  normalizedText: string;
  matchedGroup: string;
};

const bloodGroupAliases: Array<[RegExp, BloodGroup]> = [
  [/\bo\+|o positive|o pos|o_pos\b/i, BloodGroup.O_POS],
  [/\bo-|o negative|o neg|o_neg\b/i, BloodGroup.O_NEG],
  [/\ba\+|a positive|a pos|a_pos\b/i, BloodGroup.A_POS],
  [/\ba-|a negative|a neg|a_neg\b/i, BloodGroup.A_NEG],
  [/\bb\+|b positive|b pos|b_pos\b/i, BloodGroup.B_POS],
  [/\bb-|b negative|b neg|b_neg\b/i, BloodGroup.B_NEG],
  [/\bab\+|ab positive|ab pos|ab_pos\b/i, BloodGroup.AB_POS],
  [/\bab-|ab negative|ab neg|ab_neg\b/i, BloodGroup.AB_NEG],
];

@Injectable()
export class AssistantIntentService {
  normalize(message: string) {
    return message
      .trim()
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[?!.:,;()[\]{}"]/g, ' ')
      .replace(/\b(doner|donor)\b/g, 'donor')
      .replace(/\bhostiple\b/g, 'hospital')
      .replace(/\bappoinment\b/g, 'appointment')
      .replace(/\beligiblity\b/g, 'eligibility')
      .replace(/\binventry\b/g, 'inventory')
      .replace(/\bemergancy\b/g, 'emergency')
      .replace(/\bcompactible\b/g, 'compatible')
      .replace(/\binteligence\b/g, 'intelligence')
      .replace(/\s+/g, ' ');
  }

  private result(intent: AssistantIntent, normalizedText: string, matchedGroup: string, bloodGroup?: BloodGroup): DetectedIntent {
    return { intent, bloodGroup, normalizedText, matchedGroup };
  }

  detect(message: string): DetectedIntent {
    const text = this.normalize(message);
    const bloodGroup = bloodGroupAliases.find(([pattern]) => pattern.test(message) || pattern.test(text))?.[1];

    if (/^(hi|hello|hey)\b|good morning|good afternoon|good evening/.test(text)) return this.result('GREETING', text, 'greeting', bloodGroup);
    if (/diagnose|treatment|medicine|prescribe|symptom|chest pain|bleeding|unconscious/.test(text)) return this.result('UNSUPPORTED_TOPIC', text, 'medical-safety', bloodGroup);
    if (/weather|football|movie|recipe|stock market|crypto|politics|homework/.test(text)) return this.result('UNSUPPORTED_TOPIC', text, 'unrelated-topic', bloodGroup);
    if (/help|what can you do|assistant/.test(text)) return this.result('HELP', text, 'help', bloodGroup);
    if (/what is bloodsos|how does bloodsos|platform/.test(text)) return this.result('PLATFORM_OVERVIEW', text, 'platform-overview', bloodGroup);
    if (/support|contact|reset password|forgot password/.test(text)) return this.result('CONTACT_SUPPORT', text, 'support', bloodGroup);

    if (/open|go to|take me|show/.test(text)) {
      if (/donor communication/.test(text)) return this.result('OPEN_DONOR_COMMUNICATIONS', text, 'navigation-donor-communications', bloodGroup);
      if (/stock intelligence/.test(text)) return this.result('OPEN_STOCK_INTELLIGENCE', text, 'navigation-stock-intelligence', bloodGroup);
      if (/ai intelligence|ai recommendation/.test(text)) return this.result('OPEN_AI_INTELLIGENCE', text, 'navigation-ai-intelligence', bloodGroup);
      if (/inventory|stock/.test(text)) return this.result('OPEN_INVENTORY', text, 'navigation-inventory', bloodGroup);
      if (/appointment|booking/.test(text)) return this.result('OPEN_APPOINTMENTS', text, 'navigation-appointments', bloodGroup);
      if (/clinical review|health form/.test(text)) return this.result('OPEN_CLINICAL_REVIEWS', text, 'navigation-clinical-reviews', bloodGroup);
      if (/notification|alert/.test(text)) return this.result('OPEN_NOTIFICATIONS', text, 'navigation-notifications', bloodGroup);
      if (/report|audit/.test(text)) return this.result('OPEN_REPORTS', text, 'navigation-reports', bloodGroup);
      if (/profile|account/.test(text)) return this.result('OPEN_PROFILE', text, 'navigation-profile', bloodGroup);
      if (/map|nearby|hospital|blood bank|center/.test(text)) return this.result('OPEN_LIVE_MAP', text, 'navigation-live-map', bloodGroup);
      if (/dashboard|home/.test(text)) return this.result('OPEN_DASHBOARD', text, 'navigation-dashboard', bloodGroup);
      if (/request/.test(text)) return this.result('CLARIFY_REQUESTS', text, 'navigation-requests-clarify', bloodGroup);
    }

    if (/eligibility status|am i eligible|can i donate|am i approved|approved to donate|hospital approved me|clinical status|next eligible/.test(text)) return this.result('DONOR_ELIGIBILITY_STATUS', text, 'donor-eligibility', bloodGroup);
    if (/next appointment|upcoming appointment|when.*appointment|do i have.*appointment|appointment date|when am i donating|upcoming booking|my booking/.test(text)) return this.result('DONOR_NEXT_APPOINTMENT', text, 'donor-next-appointment', bloodGroup);
    if (/donation history|completed donations|donated|my donations/.test(text)) return this.result('DONOR_DONATION_HISTORY', text, 'donor-donation-history', bloodGroup);
    if (/unread notification|notification count|my notifications/.test(text)) return this.result('DONOR_NOTIFICATION_COUNT', text, 'donor-notifications', bloodGroup);

    if (/critical blood|which.*critical|shortage|blood.*running out|stock alert|blood type.*attention|blood groups.*low|which blood.*low/.test(text)) return this.result('HOSPITAL_CRITICAL_GROUPS', text, 'hospital-critical-groups', bloodGroup);
    if (/today.*appointment|appointments today/.test(text)) return this.result('HOSPITAL_TODAY_APPOINTMENTS', text, 'hospital-today-appointments', bloodGroup);
    if (/open emergency request|active request|emergency request|blood request|pending request/.test(text)) return this.result('HOSPITAL_OPEN_REQUESTS', text, 'hospital-open-requests', bloodGroup);
    if (/expiring/.test(text)) return this.result('HOSPITAL_EXPIRING_UNITS', text, 'hospital-expiring-units', bloodGroup);
    if (/available approved donor|available donor/.test(text)) return this.result('HOSPITAL_AVAILABLE_DONORS', text, 'hospital-available-donors', bloodGroup);
    if (/current inventory|inventory status|stock status|stock level|do we have|have .*blood|is .*available|what is our .*stock|show .*inventory/.test(text)) return this.result('HOSPITAL_STOCK_STATUS', text, 'hospital-stock-status', bloodGroup);
    if (/explain.*ai|current ai|ai explanation/.test(text)) return this.result('HOSPITAL_AI_EXPLANATION', text, 'hospital-ai-explanation', bloodGroup);
    if (/recent alert|latest alert/.test(text)) return this.result('HOSPITAL_RECENT_ALERTS', text, 'hospital-recent-alerts', bloodGroup);

    if (/hospitals.*attention|requiring attention/.test(text)) return this.result('ADMIN_HOSPITALS_REQUIRING_ATTENTION', text, 'admin-hospitals-attention', bloodGroup);
    if (/system.*critical|system-wide critical/.test(text)) return this.result('ADMIN_SYSTEM_CRITICAL_GROUPS', text, 'admin-system-critical', bloodGroup);
    if (/donor total|registration total/.test(text)) return this.result('ADMIN_DONOR_TOTALS', text, 'admin-donor-totals', bloodGroup);
    if (/hospital total|active hospital/.test(text)) return this.result('ADMIN_HOSPITAL_TOTALS', text, 'admin-hospital-totals', bloodGroup);
    if (/ai history|recommendation history/.test(text)) return this.result('ADMIN_AI_HISTORY', text, 'admin-ai-history', bloodGroup);
    if (/audit activity|recent audit/.test(text)) return this.result('ADMIN_RECENT_AUDIT_ACTIVITY', text, 'admin-audit-activity', bloodGroup);

    return this.result('FAQ', text, 'faq', bloodGroup);
  }
}
