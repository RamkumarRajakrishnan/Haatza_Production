import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller(['notifications', 'api/notifications'])
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Get user notifications' })
  @Get()
  getUserNotifications(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.getUserNotifications(
      userId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get unread notifications count' })
  @Get('unread-count')
  getUnreadCount(@Query('userId') userId: string) {
    return this.notificationService.getUnreadCount(userId);
  }

  @ApiOperation({ summary: 'Mark notification as read' })
  @Post(['read', ':id/read'])
  markAsRead(@Param('id') paramId: string, @Body() body: any) {
    const id = paramId || body?.id || body?.notificationId;
    return this.notificationService.markAsRead(id);
  }
}
