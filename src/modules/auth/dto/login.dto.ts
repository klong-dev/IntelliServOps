import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
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
    description: 'Email address of the actor',
  })
  @IsEmail()
  email: string;

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
