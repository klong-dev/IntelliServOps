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
import {
  CreateViewingRequestDto,
  CreateAppointmentDto,
  ViewingRequestResponseDto,
  AppointmentResponseDto,
} from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Viewing Requests')
@Controller('viewing-requests')
export class ViewingRequestsController {
  constructor(
    private readonly viewingRequestsService: ViewingRequestsService,
  ) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Submit viewing request',
    description: 'Guest submits a request to view an apartment',
  })
  @ApiResponse({ status: 201, description: 'Request submitted', type: ViewingRequestResponseDto })
  async create(@Body() createDto: CreateViewingRequestDto) {
    return this.viewingRequestsService.create(createDto);
  }

  @Get('my-assigned')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get viewing requests assigned to me' })
  @ApiResponse({ status: 200, description: 'List of assigned viewing requests', type: [ViewingRequestResponseDto] })
  async getMyAssigned(@CurrentUser() currentUser: JwtPayload) {
    return this.viewingRequestsService.getMyAssigned(currentUser);
  }

  @Post(':contactRequestId/appointments')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Create appointment from viewing request',
    description: 'Staff creates an appointment for a viewing',
  })
  @ApiResponse({ status: 201, description: 'Appointment created', type: AppointmentResponseDto })
  async createAppointment(
    @Param('contactRequestId', ParseUUIDPipe) contactRequestId: string,
    @Body() createDto: CreateAppointmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.createAppointment(
      contactRequestId,
      createDto,
      currentUser,
    );
  }

  @Get('apartments/:apartmentId/appointments')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get apartment appointments for a date' })
  @ApiQuery({ name: 'date', required: true, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Apartment appointments', type: [AppointmentResponseDto] })
  async getApartmentAppointments(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Query('date') date: string,
  ) {
    return this.viewingRequestsService.getApartmentAppointments(apartmentId, date);
  }
}
