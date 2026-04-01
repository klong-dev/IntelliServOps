import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AmenityListItemDto {
  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  id: string;

  @ApiProperty({ example: 'wifi' })
  code: string;

  @ApiProperty({ example: 'Wi-Fi' })
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Internet wireless tốc độ cao',
  })
  description: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'wifi-icon' })
  icon: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    example: 12,
    description: 'Number of apartments currently linked to this amenity',
  })
  linkedApartments: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AmenityDetailDto extends AmenityListItemDto {}

export class AmenityMutationResultDto {
  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  id: string;

  @ApiProperty({ example: 'wifi' })
  code: string;

  @ApiProperty({ example: 'Wi-Fi' })
  name: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
