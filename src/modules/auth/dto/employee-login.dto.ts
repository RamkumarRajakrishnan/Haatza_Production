import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EmployeeLoginDto {
  @ApiProperty({
    description: 'Employee Email address',
    example: 'employee@haatza.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @ApiProperty({
    description: 'Employee password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
