import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { CreateApartmentDto, UpdateApartmentDto, SearchApartmentDto } from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Apartments')
@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search apartments',
    description: 'Search available apartments with filters. Public endpoint.',
  })
  @ApiResponse({ status: 200, description: 'List of apartments with pagination' })
  async search(@Query() searchDto: SearchApartmentDto) {
    return this.apartmentsService.search(searchDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get apartment details',
    description: 'Get full apartment details by ID. Public endpoint.',
  })
  @ApiResponse({ status: 200, description: 'Apartment details' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create apartment',
    description: 'Create new apartment listing. Admin, Operator, or Partner only.',
  })
  @ApiResponse({ status: 201, description: 'Apartment created' })
  async create(
    @Body() createDto: CreateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update apartment',
    description: 'Update apartment details. Partners can only update their own.',
  })
  @ApiResponse({ status: 200, description: 'Apartment updated' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete apartment',
    description: 'Soft delete apartment (mark as inactive). Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Apartment deactivated' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.remove(id);
  }

  @Get('partner/:partnerId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get partner apartments',
    description: 'Get all apartments owned by a partner.',
  })
  @ApiResponse({ status: 200, description: 'List of partner apartments' })
  async findByPartner(@Param('partnerId', ParseUUIDPipe) partnerId: string) {
    return this.apartmentsService.findByPartner(partnerId);
  }

  @Patch(':id/approve')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve apartment',
    description: 'Approve apartment for listing. Operator or Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Apartment approved' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.approve(id, currentUser.sub);
  }
}
