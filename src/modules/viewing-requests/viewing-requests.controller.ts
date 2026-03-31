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
  CreateUserViewingRequestDto,
  MyViewingRequestsQueryDto,
  AppointmentResponseDto,
  UserViewingBookingResponseDto,
  UserMyViewingRequestDto,
} from './dto';
import { CancelViewingRequestDto } from './dto/cancel-viewing-request.dto';
import { DoneViewingRequestDto } from './dto/done-viewing-request.dto';
import { StaffAcceptViewingRequestDto } from './dto/staff-accept-viewing-request.dto';
import { StaffDenyViewingRequestDto } from './dto/staff-deny-viewing-request.dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Viewing Requests')
@Controller('viewing-requests')
export class ViewingRequestsController {
  constructor(
    private readonly viewingRequestsService: ViewingRequestsService,
  ) {}

  @Post('user/book')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'User books apartment viewing',
    description:
      'Authenticated user books a viewing by sending apartmentId and appointmentAt. Note is optional.',
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
      withoutNote: {
        summary: 'Booking request without note',
        value: {
          apartmentId: '11111111-2222-3333-4444-555555555555',
          appointmentAt: '2026-03-24T09:30:00.000Z',
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
  @ApiResponse({
    status: 409,
    description:
      'Requested slot is full or user already has an active appointment for this apartment',
  })
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
  @ApiOperation({ summary: 'Get appointments assigned to me' })
  @ApiJsonResponse(AppointmentResponseDto, {
    isArray: true,
    description: 'List of assigned appointments',
  })
  async getMyAssigned(@CurrentUser() currentUser: JwtPayload) {
    return this.viewingRequestsService.getMyAssigned(currentUser);
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

  @Patch('staff/accept')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF)
  @ApiOperation({
    summary: 'Assigned staff accepts viewing request',
    description:
      'Assigned staff accepts a viewing request by appointmentId. System sets status to confirmed and notifies user.',
  })
  @ApiBody({ type: StaffAcceptViewingRequestDto })
  @ApiJsonResponse(AppointmentResponseDto, {
    description:
      'Appointment confirmed successfully with full appointment data',
  })
  @ApiResponse({
    status: 403,
    description: 'Current staff is not assigned to this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  acceptViewingRequest(
    @Body() dto: StaffAcceptViewingRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.acceptViewingRequest(dto, currentUser);
  }

  @Patch('staff/deny')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF)
  @ApiOperation({
    summary: 'Assigned staff denies viewing request',
    description:
      'Assigned staff denies a viewing request by appointmentId. System sets status to cancelled and notifies user.',
  })
  @ApiBody({ type: StaffDenyViewingRequestDto })
  @ApiJsonResponse(AppointmentResponseDto, {
    description: 'Appointment denied successfully with full appointment data',
  })
  @ApiResponse({
    status: 403,
    description: 'Current staff is not assigned to this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  denyViewingRequest(
    @Body() dto: StaffDenyViewingRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.denyViewingRequest(dto, currentUser);
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
  @ApiBody({
    type: DoneViewingRequestDto,
    examples: {
      doneWithNote: {
        summary: 'Done viewing with note',
        value: {
          note: 'Khach da xem nha, se phan hoi trong 2 ngay toi.',
        },
      },
      doneWithoutNote: {
        summary: 'Done viewing without note',
        value: {},
      },
    },
  })
  @ApiJsonResponse(AppointmentResponseDto, {
    description:
      'Appointment completed successfully with full appointment data',
  })
  @ApiResponse({
    status: 403,
    description: 'Current staff is not assigned to this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async confirmDoneJob(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: DoneViewingRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.confirmDoneJob(
      appointmentId,
      currentUser,
      dto,
    );
  }

  @Patch('appointments/:appointmentId/cancel')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Cancel appointment',
    description:
      'Assigned staff or appointment owner user cancels an appointment. System marks appointment as cancelled.',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'Appointment ID to cancel',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @ApiBody({
    type: CancelViewingRequestDto,
    examples: {
      cancelWithNote: {
        summary: 'Cancel appointment with note',
        value: {
          note: 'Nguoi dung ban viec dot xuat, xin doi lich tuan sau.',
        },
      },
      cancelWithoutNote: {
        summary: 'Cancel appointment without note',
        value: {},
      },
    },
  })
  @ApiJsonResponse(AppointmentResponseDto, {
    description:
      'Appointment cancelled successfully with full appointment data',
  })
  @ApiResponse({
    status: 403,
    description: 'Current actor has no permission to cancel this appointment',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancelAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: CancelViewingRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.viewingRequestsService.cancelAppointment(
      appointmentId,
      currentUser,
      dto,
    );
  }
}
