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
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ApartmentPoliciesService } from './apartment-policies.service';
import {
  CreateApartmentPolicyDto,
  UpdateApartmentPolicyDto,
  ApartmentPolicyListItemDto,
  ApartmentPolicyDetailDto,
  ApartmentPolicyMutationResultDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Apartment Policies')
@Controller('apartment-policies')
export class ApartmentPoliciesController {
  constructor(
    private readonly apartmentPoliciesService: ApartmentPoliciesService,
  ) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'List apartment-policy assignments',
    description: 'Get all apartment-policy assignments with optional filters',
  })
  @ApiQuery({ name: 'apartmentId', required: false, type: String })
  @ApiQuery({ name: 'policyId', required: false, type: String })
  @ApiQuery({ name: 'isRequired', required: false, type: Boolean })
  @ApiJsonResponse(ApartmentPolicyListItemDto, {
    isArray: true,
    description: 'List of apartment-policy assignments',
  })
  async findAll(
    @Query('apartmentId') apartmentId?: string,
    @Query('policyId') policyId?: string,
    @Query('isRequired', new ParseBoolPipe({ optional: true }))
    isRequired?: boolean,
  ) {
    return this.apartmentPoliciesService.findAll({
      apartmentId,
      policyId,
      isRequired,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get apartment-policy assignment details' })
  @ApiJsonResponse(ApartmentPolicyDetailDto, {
    description: 'Apartment-policy assignment details',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentPoliciesService.findOne(id);
  }

  @Get('apartment/:apartmentId')
  @Public()
  @ApiOperation({
    summary: 'Get policies for an apartment',
    description:
      'Get all policies assigned to a specific apartment. Public endpoint.',
  })
  @ApiQuery({ name: 'isRequired', required: false, type: Boolean })
  @ApiJsonResponse(ApartmentPolicyDetailDto, {
    isArray: true,
    description: 'Apartment policies',
  })
  async findByApartment(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Query('isRequired', new ParseBoolPipe({ optional: true }))
    isRequired?: boolean,
  ) {
    return this.apartmentPoliciesService.findByApartment(
      apartmentId,
      isRequired,
    );
  }

  @Get('policy/:policyId')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Get apartments with a specific policy',
    description: 'Get all apartments that have a specific policy assigned',
  })
  @ApiJsonResponse(ApartmentPolicyDetailDto, {
    isArray: true,
    description: 'Policy apartment assignments',
  })
  async findByPolicy(@Param('policyId', ParseUUIDPipe) policyId: string) {
    return this.apartmentPoliciesService.findByPolicy(policyId);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Assign policy to apartment',
    description: 'Create a new apartment-policy assignment',
  })
  @ApiJsonResponse(ApartmentPolicyMutationResultDto, {
    status: 201,
    description: 'Policy assigned to apartment',
  })
  @ApiResponse({ status: 404, description: 'Apartment or policy not found' })
  @ApiResponse({ status: 409, description: 'Assignment already exists' })
  async create(@Body() createDto: CreateApartmentPolicyDto) {
    return this.apartmentPoliciesService.create(createDto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Update apartment-policy assignment' })
  @ApiJsonResponse(ApartmentPolicyMutationResultDto, {
    description: 'Assignment updated',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApartmentPolicyDto,
  ) {
    return this.apartmentPoliciesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove policy from apartment' })
  @ApiResponse({ status: 200, description: 'Assignment removed' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentPoliciesService.remove(id);
  }

  @Post('bulk-assign/:policyId')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Bulk assign policy to apartments',
    description: 'Assign a policy to multiple apartments at once',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        apartmentIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          example: [
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          ],
        },
      },
      required: ['apartmentIds'],
    },
  })
  async bulkAssign(
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body('apartmentIds') apartmentIds: string[],
  ) {
    return this.apartmentPoliciesService.bulkAssign(policyId, apartmentIds);
  }
}
