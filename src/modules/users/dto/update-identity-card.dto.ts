import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class UpdateIdentityCardDto {
  @ApiProperty({
    example: 'https://example.com/identity-card.jpg',
    description: 'URL of the identity card image (profileImageUrl)',
  })
  @IsUrl()
  @IsNotEmpty()
  profileImageUrl: string;
}
