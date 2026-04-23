import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatRespondRequestDto } from './dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(ApiKeyGuard)
  @Post('v1/chat/respond')
  async respond(@Body() request: ChatRespondRequestDto) {
    return this.aiService.respond(request);
  }

  @UseGuards(ApiKeyGuard)
  @Get('v1/meta/models')
  async getModels() {
    return this.aiService.getModels();
  }
}
