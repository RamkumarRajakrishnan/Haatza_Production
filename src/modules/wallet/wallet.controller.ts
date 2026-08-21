import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PayWithWalletDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Seller Wallet Subscriptions')
@Controller(['_functions', 'api/v1', ''])
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(['checkWalletBalance', 'wallet/balance'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check Available Seller Wallet Balance' })
  @ApiResponse({ status: 200, description: 'Wallet balance fetched successfully' })
  async checkWalletBalance(@Req() req: any) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.walletService.checkWalletBalance(sellerId);
  }

  @Post(['payWithWallet', 'wallet/pay-subscription'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay Subscription Using Seller Wallet' })
  @ApiBody({ type: PayWithWalletDto })
  async payWithWallet(@Req() req: any, @Body() dto: PayWithWalletDto) {
    const sellerId = req.user?.sellerId || req.user?.id || 'TEST_SELLER_001';
    return await this.walletService.payWithWallet(sellerId, dto);
  }
}
