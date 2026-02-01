import {
  Controller,
  Get,
  Post,
  Body,
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
import { ViewingRequestsService } from './viewing-requests.service';
import { CreateViewingRequestDto, CreateAppointmentDto } from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Viewing Requests')
@Controller('viewing-requests')
export class ViewingRequestsController {
  constructor(private readonly viewingRequestsService: ViewingRequestsService) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Submit viewing request',
    description: 'Guest submits request to view an apartment. Staff is auto-assigned based on proximity.',
  })
  @ApiResponse({ status: 201, description: 'Viewing request created' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async create(@Body() createDto: CreateViewingRequestDto) {
    return this.viewingRequestsService.create(createDto);
  }

  @Get('my-assigned')
  @ApiBearerAuth()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Get my assigned viewing requests',
    description: 'Staff sees viewing requests in their working area.',
  })
  @ApiResponse({ status: 200, description: 'List of assigned viewing requests' })
  async getMyAssigned(@CurrentUser() currentUser: JwtPayload) {
    return this.viewingRequestsService.getMyAssigned(currentUser);
  }

  @Post(':id/appointments')
  @ApiBearerAuth()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Create appointment from viewing request',
    description: 'Staff creates appointment after contacting guest. Checks slot limits.',
  })
  @ApiResponse({ status: 201, description: 'Appointment created' })
  @ApiResponse({ status: 409, description: 'Slot is full' })
  async createAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createDto: CreateAppointmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.createAppointment(id, createDto, currentUser);
  }

  @Get('apartments/:apartmentId/appointments')
  @ApiBearerAuth()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Get apartment appointments for a date',
    description: 'View scheduled appointments for an apartment so staff can see when it is busy.',
  })
  @ApiQuery({ name: 'date', required: true, example: '2026-02-10' })
  async getApartmentAppointments(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Query('date') date: string,
  ) {
    return this.viewingRequestsService.getApartmentAppointments(apartmentId, date);
  }
}
