import { ApiProperty } from '@nestjs/swagger';

export class StaffNoteResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  staffId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;

  @ApiProperty({
    example: 'Customer inquired about apartment upgrade options.',
  })
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class StaffNoteDetailDto extends StaffNoteResponseDto {
  @ApiProperty({
    example: {
      id: '...',
      fullName: 'Nguyen Van B',
      email: 'staff@example.com',
    },
    description: 'Staff who created the note',
  })
  staff: { id: string; fullName: string; email: string };

  @ApiProperty({
    example: { id: '...', fullName: 'Nguyen Van A', email: 'user@example.com' },
    description: 'User the note is about',
  })
  user: { id: string; fullName: string; email: string };
}
