import { SmsPurpose, SmsStatus } from '@prisma/client';

export type SmsErrorCode =
  | 'SMS_DISABLED'
  | 'SMS_NOT_CONFIGURED'
  | 'INVALID_RECIPIENT'
  | 'NO_VALID_RECIPIENTS'
  | 'MESSAGE_TOO_LONG'
  | 'RECIPIENT_LIMIT_EXCEEDED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_REJECTED'
  | 'INSUFFICIENT_CREDIT'
  | 'INVALID_SENDER_ID'
  | 'UNKNOWN_PROVIDER_RESPONSE'
  | 'DUPLICATE_SUPPRESSED';

export type SmsRecipientInput = string | null | undefined;

export type SmsSendInput = {
  recipients: SmsRecipientInput[];
  message: string;
  purpose: SmsPurpose;
  hospitalId?: string | null;
  triggeredByUserId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  idempotencyKey?: string | null;
  messagePreviewOverride?: string | null;
};

export type SmsSendResult = {
  success: boolean;
  status: SmsStatus;
  provider: string;
  providerCampaignId?: string | null;
  requestedRecipients: number;
  validRecipients: number;
  sentCount: number;
  rejectedCount: number;
  skippedInvalidRecipients: number;
  creditUsed?: number | null;
  creditLeft?: number | null;
  providerCode?: string | null;
  providerMessage?: string | null;
  errorCode?: SmsErrorCode | null;
  errorMessage?: string | null;
  smsLogId?: string | null;
};

export type BmsQuickSmsResponse = {
  status?: string;
  code?: string;
  message?: string;
  summary?: {
    _id?: string;
    total_sent?: number;
    contacts?: number;
    total_rejected?: number;
    credit_used?: number;
    credit_left?: number;
  };
};
