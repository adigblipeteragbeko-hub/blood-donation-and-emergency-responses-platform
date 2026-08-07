import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('health')
  health() {
    return this.assistant.health();
  }

  @Get('suggestions')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DONOR, Role.HOSPITAL_ADMIN)
  suggestions(@CurrentUser() user: { id: string; role: Role }) {
    return this.assistant.suggestions(user);
  }

  @Post('message')
  @UseGuards(JwtAccessGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.ADMIN, Role.DONOR, Role.HOSPITAL_ADMIN)
  @Throttle({ default: { limit: 60, ttl: 600_000 } })
  message(@CurrentUser() user: { id: string; role: Role }, @Body() dto: AssistantMessageDto) {
    return this.assistant.privateMessage(dto, user);
  }

  @Post('clear')
  @UseGuards(JwtAccessGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DONOR, Role.HOSPITAL_ADMIN)
  clear(@CurrentUser() user: { id: string; role: Role }) {
    return this.assistant.clear(user);
  }

  @Post('public/message')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  publicMessage(@Body() dto: AssistantMessageDto) {
    return this.assistant.publicMessage(dto);
  }

  @Get('public/suggestions')
  publicSuggestions() {
    return this.assistant.suggestions();
  }
}
