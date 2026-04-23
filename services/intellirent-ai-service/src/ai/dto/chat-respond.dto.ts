import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContextChunkDto } from './context-chunk.dto';

const actorTypes = ['guest', 'user', 'staff', 'operator', 'admin', 'system'];

export class ChatRespondOptionsDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(2048)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @IsOptional()
  @IsString()
  fallbackModel?: string;
}

export class ChatRespondRequestDto {
  @IsString()
  conversationId!: string;

  @IsIn(actorTypes)
  actorType!: string;

  @IsString()
  message!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextChunkDto)
  context!: ContextChunkDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatRespondOptionsDto)
  options?: ChatRespondOptionsDto;
}
