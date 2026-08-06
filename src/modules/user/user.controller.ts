import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckUserQueryDto } from './dto/check-user-query.dto';
import {
  CheckUserErrorResponseDto,
  CheckUserResponseDto,
} from './dto/check-user-response.dto';

@ApiTags('Users')
@Controller(['users', 'api/users', 'api/customer'])
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @ApiOperation({ summary: 'Get all active device sessions for current user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/sessions')
  getSessions(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const currentSessionId = req.user?.sessionId;
    return this.authService.getUserActiveSessions(userId, currentSessionId);
  }

  @ApiOperation({ summary: 'Terminate a specific device session' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me/sessions/:sessionId')
  revokeSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.authService.revokeSession(userId, sessionId);
  }

  @ApiOperation({ summary: 'Terminate all other active device sessions except current' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/sessions/revoke-others')
  revokeOthers(@Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const currentSessionId = req.user?.sessionId;
    return this.authService.revokeAllOtherSessions(userId, currentSessionId);
  }

  @ApiOperation({
    summary: 'Check whether a user already exists by email or phoneNumber',
    description:
      'Checks if a user exists with the given email, phone number, or both. Requires at least one query parameter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns existence check result',
    type: CheckUserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Neither email nor phoneNumber provided or invalid format',
    type: CheckUserErrorResponseDto,
  })
  @Get('check')
  async checkUser(@Query() query: CheckUserQueryDto): Promise<CheckUserResponseDto> {
    return this.userService.checkUserExists(query);
  }

  @ApiOperation({ summary: 'Get user profile details' })
  @Get(['profile', 'details'])
  getUserProfile(
    @Query('userId') userId: string,
    @Query('id') queryId: string,
  ) {
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
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getAllUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
