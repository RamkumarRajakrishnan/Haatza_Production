import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { GrowPlanService } from './grow-plan.service';
import { CreateGrowPlanDto } from './dto/create-grow-plan.dto';
import { UpdateGrowPlanDto } from './dto/update-grow-plan.dto';

@ApiTags('Grow Plan Page')
@Controller(['grow-plans', 'api/v1/grow-plans'])
export class GrowPlanController {
  constructor(private readonly growPlanService: GrowPlanService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Grow Plan page record' })
  @ApiBody({ type: CreateGrowPlanDto })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  async create(@Body() dto: CreateGrowPlanDto) {
    return await this.growPlanService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of Grow Plan page records with filters' })
  @ApiQuery({ name: 'sellerId', required: false, type: String })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of records retrieved' })
  async findAll(
    @Query('sellerId') sellerId?: string,
    @Query('email') email?: string,
    @Query('status') status?: string,
  ) {
    return await this.growPlanService.findAll({ sellerId, email, status });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get details of a single Grow Plan page record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.growPlanService.findOne(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing Grow Plan page record' })
  @ApiBody({ type: UpdateGrowPlanDto })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdateGrowPlanDto) {
    return await this.growPlanService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a Grow Plan page record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  async remove(@Param('id') id: string) {
    return await this.growPlanService.remove(id);
  }
}
