import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { UpdateHousePasswordDto } from './dto/update-house-password.dto';
import { UpdateUserApartmentAccessDto, UserApartmentResponseDto } from './dto';
import { UserApartmentsService } from './user-apartments.service';

@ApiTags('User Apartments')
@ApiBearerAuth('JWT-auth')
@Controller('user-apartments')
export class UserApartmentsController {
  constructor(private readonly userApartmentsService: UserApartmentsService) {}

  @Get('my')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get apartments assigned to current user' })
  @ApiJsonResponse(UserApartmentResponseDto, {
    isArray: true,
    description: 'User apartment assignments with access info',
  })
  async findMy(@CurrentUser() currentUser: JwtPayload) {
    return this.userApartmentsService.findMy(currentUser);
  }

  @Patch(':id/access-info')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Update user-apartment access information' })
  @ApiJsonResponse(UserApartmentResponseDto, {
    description: 'Updated user-apartment assignment',
  })
  @ApiResponse({
    status: 404,
    description: 'User apartment assignment not found',
  })
  async updateAccessInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserApartmentAccessDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.userApartmentsService.updateAccessInfo(id, dto, currentUser);
  }

  @Patch(':id/house-password')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'User updates own house password' })
  @ApiJsonResponse(UserApartmentResponseDto, {
    description: 'Updated user-apartment assignment',
  })
  @ApiResponse({
    status: 404,
    description: 'User apartment assignment not found',
  })
  updateMyHousePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHousePasswordDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<unknown> {
    return this.userApartmentsService.updateAccessInfo(
      id,
      { apartmentDoorPassword: dto.housePassword },
      currentUser,
    );
  }
}
