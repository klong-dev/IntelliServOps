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
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { UpdateHousePasswordDto } from './dto/update-house-password.dto';
import { UpdateUserApartmentAccessDto } from './dto';
import {
  UserApartmentDetailDto,
  UserApartmentListItemDto,
  UserApartmentMutationResultDto,
} from './dto/user-apartment-response.dto';
import { UserApartmentsService } from './user-apartments.service';

@ApiTags('User Apartments')
@ApiBearerAuth('JWT-auth')
@Controller('user-apartments')
export class UserApartmentsController {
  constructor(private readonly userApartmentsService: UserApartmentsService) {}

  @Get('my')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Get apartments assigned to current user',
    description:
      'Tra ve danh sach user-apartment cua user hien tai, bao gom day du thong tin apartment va thong tin truy cap.',
  })
  @ApiJsonResponse(UserApartmentListItemDto, {
    isArray: true,
    description: 'User apartment assignments with full apartment information',
  })
  async findMy(@CurrentUser() currentUser: JwtPayload) {
    return this.userApartmentsService.findMy(currentUser);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get user-apartment assignment detail by id',
    description:
      'Tra ve chi tiet user-apartment theo id, populate day du cac thong tin lien quan.',
  })
  @ApiJsonResponse(UserApartmentDetailDto, {
    description: 'User apartment detail with populated related data',
  })
  @ApiResponse({
    status: 404,
    description: 'User apartment assignment not found',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<unknown> {
    const userApartmentsService = this.userApartmentsService as {
      findOne: (assignmentId: string, actor: JwtPayload) => Promise<unknown>;
    };
    return userApartmentsService.findOne(id, currentUser);
  }

  @Patch(':id/access-info')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Update user-apartment access information' })
  @ApiBody({
    type: UpdateUserApartmentAccessDto,
    examples: {
      operatorUpdate: {
        summary: 'Staff/operator/admin updates all access fields',
        value: {
          apartmentDoorPassword: '2580',
          buildingGateCode: 'GATE-9911',
          smartLockPin: 'SL-8899',
          mailboxCode: 'MB-1188',
          parkingAccessCode: 'PARK-B2-99',
          wifiName: 'INTELLI_HOME_12A',
          wifiPassword: 'Wifi@2026#Safe',
          emergencyContactName: 'To ky thuat toa A',
          emergencyContactPhone: '0901234567',
          notes: 'Khong cung cap cho ben thu ba',
        },
      },
      userUpdate: {
        summary: 'User can only update house password',
        value: {
          apartmentDoorPassword: '7890',
        },
      },
    },
  })
  @ApiJsonResponse(UserApartmentMutationResultDto, {
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
  @ApiBody({
    type: UpdateHousePasswordDto,
    examples: {
      updateHousePassword: {
        summary: 'Update own apartment door password',
        value: {
          housePassword: '2580',
        },
      },
    },
  })
  @ApiJsonResponse(UserApartmentMutationResultDto, {
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
