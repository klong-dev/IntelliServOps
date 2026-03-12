import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PartnerIdentityDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  partnerId: string;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ example: 'A12345678', nullable: true })
  passportNumber: string | null;

  @ApiPropertyOptional({ example: 'Nguyen Van A', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: '01/01/1990', nullable: true })
  dob: string | null;

  @ApiPropertyOptional({ example: 'M', nullable: true })
  sex: string | null;

  @ApiPropertyOptional({ example: 'Việt Nam', nullable: true })
  nationality: string | null;

  @ApiPropertyOptional({ example: 'Kinh', nullable: true })
  ethnicity: string | null;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  home: string | null;

  @ApiPropertyOptional({
    example: '123 Tran Hung Dao, Hoan Kiem, Ha Noi',
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  province: string | null;

  @ApiPropertyOptional({ example: 'Hoan Kiem', nullable: true })
  district: string | null;

  @ApiPropertyOptional({ example: 'Hoan Kiem', nullable: true })
  ward: string | null;

  @ApiPropertyOptional({ example: '123 Tran Hung Dao', nullable: true })
  street: string | null;

  @ApiPropertyOptional({ example: 'Sẹo 2cm trán phải', nullable: true })
  features: string | null;

  @ApiPropertyOptional({ example: '01/01/2020', nullable: true })
  issueDate: string | null;

  @ApiPropertyOptional({ example: '01/01/2030', nullable: true })
  doe: string | null;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2026-03-10T10:30:00.000Z', nullable: true })
  verifiedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
