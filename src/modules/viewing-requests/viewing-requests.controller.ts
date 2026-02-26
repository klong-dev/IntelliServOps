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
import { ApiJsonResponse } from '../../common/dto';
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
  @ApiJsonResponse(ViewingRequestResponseDto, { status: 201, description: 'Request submitted' })
  async create(@Body() createDto: CreateViewingRequestDto) {
    return this.viewingRequestsService.create(createDto);
  }

  @Get('my-assigned')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get viewing requests assigned to me' })
  @ApiJsonResponse(ViewingRequestResponseDto, { isArray: true, description: 'List of assigned viewing requests' })
  async getMyAssigned(@CurrentUser() currentUser: JwtPayload) {
    return this.viewingRequestsService.getMyAssigned(currentUser);
  }

  @Post(':contactRequestId/appointments')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Create appointment from viewing request',
    description: 'Staff creates an appointment for a viewing',
  })
  @ApiJsonResponse(AppointmentResponseDto, { status: 201, description: 'Appointment created' })
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
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get apartment appointments for a date' })
  @ApiQuery({ name: 'date', required: true, description: 'Date (YYYY-MM-DD)' })
  @ApiJsonResponse(AppointmentResponseDto, { isArray: true, description: 'Apartment appointments' })
  async getApartmentAppointments(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Query('date') date: string,
  ) {
    return this.viewingRequestsService.getApartmentAppointments(apartmentId, date);
  }
}
