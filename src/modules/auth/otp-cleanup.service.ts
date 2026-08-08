import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OtpCleanupService {
  private readonly logger = new Logger(OtpCleanupService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Cron job that runs every minute to delete expired or used OTP records from OtpVerification table.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async deleteExpiredOtps() {
    try {
      const now = new Date();
      const count = await this.database.executePoolQuery(
        'DELETE FROM "otp_verifications" WHERE "expires_at" < $1 OR "is_verified" = true;',
        [now],
      );

      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired/verified OTP records from database.`);
      }
    } catch (error: any) {
      this.logger.error(`Error during OTP database cleanup job: ${error?.message}`);
    }
  }
}
