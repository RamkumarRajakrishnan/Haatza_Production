import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller(['users', 'api/users', 'api/customer'])
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get user profile details' })
  @Get(['profile', 'details'])
  getUserProfile(@Query('userId') userId: string, @Query('id') queryId: string) {
    const id = userId || queryId;
    return this.userService.getUserProfile(id);
  }

  @ApiOperation({ summary: 'Update user profile details' })
  @Put(['profile', 'update'])
  updateUserProfile(@Body() body: any) {
    return this.userService.updateUserProfile(body.userId || body.id, body);
  }

  @ApiOperation({ summary: 'List users with pagination' })
  @Get()
  getAllUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.userService.getAllUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
