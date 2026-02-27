import {
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LoginActorType {
  USER = 'user',
  STAFF = 'staff',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  PARTNER = 'partner',
}

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description:
      'Email address or phone number (starting with 0 or +84) of the actor',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    enum: LoginActorType,
    description: 'Type of actor logging in. If not provided, system will auto-detect.',
  })
  @IsEnum(LoginActorType)
  @IsOptional()
  actorType?: LoginActorType;
}
