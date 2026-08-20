import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AppbarCategoriesService } from './appbar-categories.service';
import { GetAppbarCategoriesDto } from './dto/get-appbar-categories.dto';

@ApiTags('Appbar Categories')
@Controller(['appbar-categories', 'appbar_categories', 'appbar-category'])
export class AppbarCategoriesController {
  constructor(private readonly appbarCategoriesService: AppbarCategoriesService) {}

  @Post(['', 'appbar-categories', 'appbar_categories'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Appbar Categories (POST - Recommended)',
    description:
      'Returns Appbar Categories based on module (haatza or lite). Lite module requires customer latitude and longitude for nearest warehouse distance calculation.',
  })
  @ApiBody({ type: GetAppbarCategoriesDto })
  @ApiResponse({
    status: 200,
    description: 'Appbar categories retrieved successfully',
  })
  async getAppbarCategoriesPost(@Body() dto: GetAppbarCategoriesDto) {
    try {
      return await this.appbarCategoriesService.getAppbarCategories(dto);
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof HttpException) {
        const responseJson: any = err.getResponse();
        const msg = typeof responseJson === 'object' && responseJson.message
          ? Array.isArray(responseJson.message) ? responseJson.message[0] : responseJson.message
          : err.message;

        throw new HttpException(
          {
            status: 'error',
            message: msg,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw err;
    }
  }

  @Get(['', 'appbar-categories', 'appbar_categories'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Appbar Categories (GET)',
    description:
      'Returns Appbar Categories via query parameters.',
  })
  @ApiQuery({ name: 'module', required: true, type: String })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  async getAppbarCategoriesGet(@Query() query: GetAppbarCategoriesDto) {
    try {
      return await this.appbarCategoriesService.getAppbarCategories(query);
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof HttpException) {
        const responseJson: any = err.getResponse();
        const msg = typeof responseJson === 'object' && responseJson.message
          ? Array.isArray(responseJson.message) ? responseJson.message[0] : responseJson.message
          : err.message;

        throw new HttpException(
          {
            status: 'error',
            message: msg,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw err;
    }
  }
}
