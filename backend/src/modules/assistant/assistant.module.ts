import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AssistantController } from './assistant.controller';
import { AssistantIntentService } from './assistant-intent.service';
import { AssistantKnowledgeService } from './assistant-knowledge.service';
import { AssistantNavigationService } from './assistant-navigation.service';
import { AssistantQueryService } from './assistant-query.service';
import { AssistantService } from './assistant.service';

@Module({
  imports: [CoreModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantIntentService,
    AssistantKnowledgeService,
    AssistantNavigationService,
    AssistantQueryService,
  ],
})
export class AssistantModule {}
