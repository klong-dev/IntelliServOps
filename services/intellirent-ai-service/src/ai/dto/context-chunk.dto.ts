import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ContextChunkDto {
  @IsString()
  sourceType!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
