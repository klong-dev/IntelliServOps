import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { TicketStatus } from '@prisma/client';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List tickets' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: TicketStatus,
  ) {
    return this.ticketsService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get ticket details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Create ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  async create(
    @Body() createDto: CreateTicketDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.ticketsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update ticket' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(id, updateDto);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Assign ticket to staff' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { staffId: string },
  ) {
    return this.ticketsService.assign(id, body.staffId);
  }

  @Patch(':id/resolve')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Resolve ticket' })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolutionNotes: string },
  ) {
    return this.ticketsService.resolve(id, body.resolutionNotes);
  }

  @Patch(':id/close')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Close ticket' })
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.close(id);
  }
}
