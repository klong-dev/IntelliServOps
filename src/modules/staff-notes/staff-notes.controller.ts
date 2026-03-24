import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StaffNotesService } from './staff-notes.service';
import {
  CreateStaffNoteDto,
  UpdateStaffNoteDto,
  StaffNoteDetailDto,
  StaffNoteResponseDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { RequestUser } from '../../common/types';
import { ApiJsonResponse } from '../../common/dto';

@ApiTags('Staff Notes')
@ApiBearerAuth('JWT-auth')
@Controller('staff-notes')
export class StaffNotesController {
  constructor(private readonly staffNotesService: StaffNotesService) {}

  @Post()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Create staff note',
    description:
      'Create a note about a customer interaction. Visible to other staff.',
  })
  @ApiJsonResponse(StaffNoteDetailDto, {
    status: 201,
    description: 'Note created',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async create(
    @Body() createDto: CreateStaffNoteDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.staffNotesService.create(currentUser.id, createDto);
  }

  @Get('user/:userId')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Get notes for a user',
    description:
      'Get all staff notes about a specific user. Visible to all staff.',
  })
  @ApiJsonResponse(StaffNoteDetailDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated staff notes',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.staffNotesService.findByUserId(userId, page || 1, limit || 20);
  }

  @Get(':id')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get staff note by ID' })
  @ApiJsonResponse(StaffNoteDetailDto, { description: 'Staff note details' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffNotesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Update staff note',
    description: 'Only the staff who created the note can update it.',
  })
  @ApiJsonResponse(StaffNoteDetailDto, { description: 'Note updated' })
  @ApiResponse({ status: 403, description: 'Not the note creator' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateStaffNoteDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.staffNotesService.update(id, currentUser.id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Delete staff note',
    description: 'Only the creator or admin can delete a note.',
  })
  @ApiJsonResponse(StaffNoteResponseDto, { description: 'Note deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    const isAdmin = currentUser.role === Role.ADMIN;
    return this.staffNotesService.remove(id, currentUser.id, isAdmin);
  }
}
