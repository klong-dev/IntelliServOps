import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, Roles } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import { AmenitiesService } from './amenities.service';
import {
  AmenityDetailDto,
  AmenityListItemDto,
  AmenityMutationResultDto,
  CreateAmenityDto,
  UpdateAmenityDto,
} from './dto';

@ApiTags('Amenities')
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List amenities',
    description: 'Get amenity list for apartment forms and filters.',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiJsonResponse(AmenityListItemDto, {
    isArray: true,
    description: 'Amenity list',
  })
  async findAll(
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
    @Query('keyword') keyword?: string,
  ) {
    return this.amenitiesService.findAll({ isActive, keyword });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get amenity detail' })
  @ApiJsonResponse(AmenityDetailDto, {
    description: 'Amenity detail',
  })
  @ApiResponse({ status: 404, description: 'Amenity not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.amenitiesService.findOne(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Create amenity',
    description: 'Admin/Operator creates a new amenity item.',
  })
  @ApiBody({
    type: CreateAmenityDto,
    examples: {
      createWifiAmenity: {
        summary: 'Create Wi-Fi amenity',
        value: {
          code: 'wifi',
          name: 'Wi-Fi',
          description: 'Internet wireless tốc độ cao',
          icon: 'wifi-icon',
          isActive: true,
        },
      },
    },
  })
  @ApiJsonResponse(AmenityMutationResultDto, {
    status: 201,
    description: 'Amenity created',
  })
  @ApiResponse({ status: 409, description: 'Amenity code already exists' })
  async create(@Body() createDto: CreateAmenityDto) {
    return this.amenitiesService.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Update amenity',
    description: 'Admin/Operator updates amenity metadata.',
  })
  @ApiBody({
    type: UpdateAmenityDto,
    examples: {
      updateAmenityLabel: {
        summary: 'Update amenity name and icon',
        value: {
          name: 'Wi-Fi tốc độ cao',
          icon: 'wifi-fast-icon',
          isActive: true,
        },
      },
    },
  })
  @ApiJsonResponse(AmenityMutationResultDto, {
    description: 'Amenity updated',
  })
  @ApiResponse({ status: 404, description: 'Amenity not found' })
  @ApiResponse({ status: 409, description: 'Amenity code already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAmenityDto,
  ) {
    return this.amenitiesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Deactivate amenity',
    description: 'Soft delete amenity by setting isActive=false.',
  })
  @ApiJsonResponse(AmenityMutationResultDto, {
    description: 'Amenity deactivated',
  })
  @ApiResponse({ status: 404, description: 'Amenity not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.amenitiesService.remove(id);
  }
}
