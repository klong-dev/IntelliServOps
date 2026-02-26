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
  ApiQuery,
} from '@nestjs/swagger';
import { ApartmentsService } from './apartments.service';
import {
  CreateApartmentDto,
  UpdateApartmentDto,
  SearchApartmentDto,
  ApartmentListItemDto,
  ApartmentDetailDto,
  ApartmentSearchResultDto,
} from './dto';
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
    description: 'Public endpoint to search available apartments with filters',
  })
  @ApiResponse({ status: 200, description: 'Search results', type: ApartmentSearchResultDto })
  async search(@Query() searchDto: SearchApartmentDto) {
    return this.apartmentsService.search(searchDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get apartment details' })
  @ApiResponse({ status: 200, description: 'Apartment details', type: ApartmentDetailDto })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Create apartment' })
  @ApiResponse({ status: 201, description: 'Apartment created', type: ApartmentDetailDto })
  async create(
    @Body() createDto: CreateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Update apartment' })
  @ApiResponse({ status: 200, description: 'Apartment updated', type: ApartmentDetailDto })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete apartment (soft delete)' })
  @ApiResponse({ status: 200, description: 'Apartment deactivated' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.remove(id);
  }

  @Get('partner/:partnerId')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Get apartments by partner' })
  @ApiResponse({ status: 200, description: 'Partner apartments', type: [ApartmentListItemDto] })
  async findByPartner(@Param('partnerId', ParseUUIDPipe) partnerId: string) {
    return this.apartmentsService.findByPartner(partnerId);
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Approve apartment' })
  @ApiResponse({ status: 200, description: 'Apartment approved', type: ApartmentDetailDto })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.approve(id, currentUser.sub);
  }
}
