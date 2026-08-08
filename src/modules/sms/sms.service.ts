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
  private readonly route: string;
  private readonly senderId: string;
  private readonly messageId: string;
  private readonly fast2SmsUrl = 'https://www.fast2sms.com/dev/bulkV2';

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('FAST2SMS_API_KEY') ||
      process.env.FAST2SMS_API_KEY ||
      'U7SGzfsYaueBEK1XrokqhQVOlbnNwC6ypm5Fcxiv8Z2HMAPDLgpw6LlQOo3RsIWrUmYSkuN15Cqa29fg';

    this.route =
      this.configService.get<string>('FAST2SMS_ROUTE') ||
      process.env.FAST2SMS_ROUTE ||
      'q';

    this.senderId =
      this.configService.get<string>('FAST2SMS_SENDER_ID') ||
      process.env.FAST2SMS_SENDER_ID ||
      '';

    this.messageId =
      this.configService.get<string>('FAST2SMS_MESSAGE_ID') ||
      process.env.FAST2SMS_MESSAGE_ID ||
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
   * Sends an OTP via Fast2SMS API.
   * Supports 'q' (Quick SMS), 'otp' (Fast2SMS Default Template), and 'dlt' (Custom Approved DLT Template).
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
        `Dispatching Fast2SMS OTP (Route: ${this.route}) to ${cleanedPhone}...`,
      );

      // Build query params for GET request matching Fast2SMS Dev API specification
      const urlParams = new URLSearchParams();
      urlParams.append('authorization', this.apiKey);
      urlParams.append('route', this.route);
      urlParams.append('numbers', cleanedPhone);

      if (this.route === 'q') {
        urlParams.append('message', `Your OTP verification code for Haatza is ${otpCode}. Valid for 10 minutes.`);
        urlParams.append('language', 'english');
        urlParams.append('flash', '0');
      } else if (this.route === 'dlt') {
        urlParams.append('variables_values', otpCode);
        if (this.senderId) urlParams.append('sender_id', this.senderId);
        if (this.messageId) urlParams.append('message', this.messageId);
      } else {
        urlParams.append('variables_values', otpCode);
      }

      const fullUrl = `${this.fast2SmsUrl}?${urlParams.toString()}`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          authorization: this.apiKey,
        },
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
