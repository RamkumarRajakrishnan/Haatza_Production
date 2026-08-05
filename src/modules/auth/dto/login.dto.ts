import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobile must be a valid 10-digit phone number starting with 6-9',
  })
  mobile: string;

  @IsString()
  password: string;
}
