import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class UpdateIdentityCardDto {
  @ApiProperty({
    example: 'https://example.com/identity-card-front.jpg',
    description: 'URL of the identity card front image',
  })
  @IsUrl()
  @IsNotEmpty()
  identityCardFrontUrl: string;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    description: 'URL of the identity card back image',
  })
  @IsUrl()
  @IsOptional()
  identityCardBackUrl?: string;
}
