import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Fast2SmsResponse {
  return: boolean;
  request_id?: string;
  message?: string[];
  status_code?: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly fast2SmsUrl = 'https://www.fast2sms.com/dev/bulkV2';

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('FAST2SMS_API_KEY') ||
      process.env.FAST2SMS_API_KEY ||
      '';
  }

  /**
   * Cleans and normalizes Indian mobile numbers into standard 10-digit format.
   * Examples: "+919991960762" -> "9991960762", "09991960762" -> "9991960762"
   */
  private normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Sends an OTP via Fast2SMS Quick OTP API route.
   * Fast2SMS handles the DLT OTP template automatically when route is 'otp'.
   */
  async sendOtp(phone: string, otpCode: string): Promise<boolean> {
    const cleanedPhone = this.normalizePhoneNumber(phone);

    if (!this.apiKey) {
      this.logger.warn(
        `[MOCK SMS] FAST2SMS_API_KEY is not set. OTP for ${cleanedPhone}: ${otpCode}`,
      );
      return true;
    }

    try {
      this.logger.log(
        `Dispatching Fast2SMS OTP to ${cleanedPhone}...`,
      );

      const response = await fetch(this.fast2SmsUrl, {
        method: 'POST',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otpCode,
          numbers: cleanedPhone,
        }),
      });

      const data = (await response.json()) as Fast2SmsResponse;

      if (response.ok && data.return === true) {
        this.logger.log(
          `Fast2SMS OTP sent successfully to ${cleanedPhone}. RequestId: ${data.request_id || 'N/A'}`,
        );
        return true;
      } else {
        this.logger.error(
          `Fast2SMS API failed for ${cleanedPhone}: ${JSON.stringify(data)}`,
        );
        return false;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send Fast2SMS OTP to ${cleanedPhone}: ${error?.message}`,
        error?.stack,
      );
      return false;
    }
  }
}
