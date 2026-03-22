import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ViewingRequestsService } from './viewing-requests.service';
import {
  CreateViewingRequestDto,
  CreateUserViewingRequestDto,
  CreateAppointmentDto,
  MyViewingRequestsQueryDto,
  ViewingRequestResponseDto,
  AppointmentResponseDto,
  UserViewingBookingResponseDto,
  UserMyViewingRequestDto,
} from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse, MessageResponseDto } from '../../common/dto';
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
  @ApiJsonResponse(ViewingRequestResponseDto, {
    status: 201,
    description: 'Request submitted',
  })
  async create(@Body() createDto: CreateViewingRequestDto) {
    return this.viewingRequestsService.create(createDto);
  }

  @Post('user/book')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'User books apartment viewing',
    description:
      'Authenticated user books a viewing by sending apartmentId, appointmentAt, and note.',
  })
  @ApiBody({
    type: CreateUserViewingRequestDto,
    examples: {
      userViewingBooking: {
        summary: 'Frontend request example',
        value: {
          apartmentId: '11111111-2222-3333-4444-555555555555',
          appointmentAt: '2026-03-24T09:30:00.000Z',
          note: 'Toi muon xem can ho vao buoi sang, vui long lien he truoc 30 phut.',
        },
      },
    },
  })
  @ApiJsonResponse(UserViewingBookingResponseDto, {
    status: 201,
    description: 'Viewing appointment created for user',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'User or apartment not found' })
  @ApiResponse({ status: 409, description: 'Requested slot is full' })
  async createUserViewingBooking(
    @Body() createDto: CreateUserViewingRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.createUserViewingBooking(
      createDto,
      currentUser,
    );
  }

  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Get my viewing requests',
    description:
      'Authenticated user gets their own viewing requests/appointments with optional status filter and pagination.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'],
    description: 'Filter by appointment status',
    example: 'scheduled',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 10,
  })
  @ApiJsonResponse(UserMyViewingRequestDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated list of current user viewing requests',
  })
  async getMyViewingRequests(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: MyViewingRequestsQueryDto,
  ) {
    return this.viewingRequestsService.getMyViewingRequests(currentUser, query);
  }

  @Get('my-assigned')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get viewing requests assigned to me' })
  @ApiJsonResponse(ViewingRequestResponseDto, {
    isArray: true,
    description: 'List of assigned viewing requests',
  })
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
  @ApiJsonResponse(AppointmentResponseDto, {
    status: 201,
    description: 'Appointment created',
  })
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
  @ApiJsonResponse(AppointmentResponseDto, {
    isArray: true,
    description: 'Apartment appointments',
  })
  async getApartmentAppointments(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Query('date') date: string,
  ) {
    return this.viewingRequestsService.getApartmentAppointments(
      apartmentId,
      date,
    );
  }

  @Patch('appointments/:appointmentId/confirm')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF)
  @ApiOperation({
    summary: 'Confirm viewing appointment',
    description:
      'Assigned staff confirms the viewing appointment. System marks appointment as confirmed.',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'Appointment ID to confirm',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @ApiJsonResponse(MessageResponseDto, {
    description: 'Appointment confirmed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Appointment cannot be confirmed from current status',
  })
  @ApiResponse({
    status: 403,
    description: 'Current staff is not assigned to this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async confirmAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.confirmAppointment(
      appointmentId,
      currentUser,
    );
  }

  @Patch('appointments/:appointmentId/done')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF)
  @ApiOperation({
    summary: 'Staff confirms done job',
    description:
      'Assigned staff confirms the viewing job is done. System marks appointment as completed.',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'Appointment ID that the staff completed',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @ApiJsonResponse(MessageResponseDto, {
    description: 'Job confirmed and appointment is completed',
  })
  @ApiResponse({
    status: 403,
    description: 'Current staff is not assigned to this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async confirmDoneJob(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.confirmDoneJob(
      appointmentId,
      currentUser,
    );
  }

  @Patch('appointments/:appointmentId/cancel')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Cancel appointment',
    description:
      'Staff (assigned) or user (owner) cancels an appointment. System marks appointment as cancelled.',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'Appointment ID to cancel',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @ApiJsonResponse(MessageResponseDto, {
    description: 'Appointment cancelled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'No permission to cancel appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancelAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.cancelAppointment(
      appointmentId,
      currentUser,
    );
  }
}
