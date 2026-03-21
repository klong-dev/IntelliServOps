import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApartmentsService } from './apartments.service';
import {
  CreateApartmentDto,
  UpdateApartmentDto,
  SearchApartmentDto,
  ApartmentListItemDto,
  ApartmentDetailDto,
  ApartmentMutationResultDto,
  ApartmentStatusResultDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Apartments')
@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Search apartments',
    description:
      'Public endpoint to search apartments with filters. If status is not provided, all statuses are returned.',
  })
  @ApiJsonResponse(ApartmentListItemDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated apartment search results',
  })
  async search(@Query() searchDto: SearchApartmentDto) {
    return this.apartmentsService.search(searchDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get apartment details' })
  @ApiJsonResponse(ApartmentDetailDto, { description: 'Apartment details' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Create apartment' })
  @ApiJsonResponse(ApartmentMutationResultDto, {
    status: 201,
    description: 'Apartment created',
  })
  async create(
    @Body() createDto: CreateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Update apartment' })
  @ApiJsonResponse(ApartmentMutationResultDto, {
    description: 'Apartment updated',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete apartment (soft delete)' })
  @ApiJsonResponse(ApartmentStatusResultDto, {
    description: 'Apartment deactivated',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.remove(id);
  }

  @Get('owner/:ownerId')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Get apartments by owner' })
  @ApiJsonResponse(ApartmentListItemDto, {
    isArray: true,
    description: 'Owner apartments',
  })
  async findByOwner(@Param('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.apartmentsService.findByOwner(ownerId);
  }

  @Patch(':id/approve')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Approve apartment' })
  @ApiJsonResponse(ApartmentStatusResultDto, {
    description: 'Apartment approved',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.approve(id, currentUser.sub);
  }
}
