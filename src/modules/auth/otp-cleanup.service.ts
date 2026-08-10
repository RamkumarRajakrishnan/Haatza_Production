import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OtpCleanupService {
  private readonly logger = new Logger(OtpCleanupService.name);

  constructor(private readonly database: DatabaseService) { }

  /**
   * Cron job that runs every minute to delete expired or used OTP records from OtpVerification table.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async deleteExpiredOtps() {
    try {
      const count1 = await this.database.executePoolQuery(
        'DELETE FROM otp_verifications WHERE expires_at < NOW();',
      );
      const count2 = await this.database.executePoolQuery(
        'DELETE FROM otp_verifications WHERE is_verified = true;',
      );

      const totalDeleted = count1 + count2;
      if (totalDeleted > 0) {
        this.logger.log(`Cleaned up ${totalDeleted} expired/verified OTP records from database.`);
      }
    } catch (error: any) {
      this.logger.error(`Error during OTP database cleanup job: ${error?.message}`);
    }
  }
}
