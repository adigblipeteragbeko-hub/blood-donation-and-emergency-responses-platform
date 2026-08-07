import { Injectable } from '@nestjs/common';
import { AssistantRole, publicFaq } from './knowledge/public-faq';

@Injectable()
export class AssistantKnowledgeService {
  findAnswer(message: string, role: AssistantRole) {
    const text = message.toLowerCase();
    return publicFaq.find((entry) =>
      entry.allowedRoles.includes(role) &&
      entry.questionPatterns.some((pattern) => text.includes(pattern.toLowerCase())),
    );
  }

  categories(role: AssistantRole) {
    return Array.from(new Set(publicFaq.filter((entry) => entry.allowedRoles.includes(role)).map((entry) => entry.category)));
  }
}
