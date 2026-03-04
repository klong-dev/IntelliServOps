import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, ReservationResponseDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Reservations')
@ApiBearerAuth('JWT-auth')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Create a reservation',
    description:
      'User must be verified (isVerified = true). Apartment must be available. Sets apartment status to reserved.',
  })
  @ApiJsonResponse(ReservationResponseDto, {
    status: 201,
    description: 'Reservation created successfully',
  })
  @ApiResponse({ status: 400, description: 'User not verified or invalid data' })
  @ApiResponse({ status: 404, description: 'User or apartment not found' })
  @ApiResponse({ status: 409, description: 'Apartment not available or duplicate reservation' })
  async create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return await this.reservationsService.create(
      currentUser.sub,
      createReservationDto,
    );
  }

  @Get()
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get my reservations' })
  @ApiJsonResponse(ReservationResponseDto, {
    isArray: true,
    description: 'List of user reservations',
  })
  async findMyReservations(@CurrentUser() currentUser: JwtPayload) {
    return await this.reservationsService.findMyReservations(currentUser.sub);
  }

  @Get(':id')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get reservation by ID' })
  @ApiJsonResponse(ReservationResponseDto, {
    description: 'Reservation details',
  })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return await this.reservationsService.findOne(id, currentUser.sub);
  }

  @Patch(':id/cancel')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Cancel a reservation',
    description: 'Cancels the reservation and sets apartment status back to available.',
  })
  @ApiJsonResponse(ReservationResponseDto, {
    description: 'Reservation cancelled',
  })
  @ApiResponse({ status: 400, description: 'Reservation already cancelled or expired' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return await this.reservationsService.cancel(id, currentUser.sub);
  }
}
