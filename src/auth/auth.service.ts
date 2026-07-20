import {
    Injectable,
    ConflictException,
    UnauthorizedException
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {

    constructor(
        private database: DatabaseService,
        private jwtService: JwtService,
    ) { }


    async register(data: RegisterDto) {

        const existingUser = await this.database.user.findUnique({
            where: {
                mobile: data.mobile
            }
        });


        if (existingUser) {
            throw new ConflictException(
                'Mobile number already registered'
            );
        }


        const hashedPassword = await bcrypt.hash(
            data.password,
            10
        );


        const user = await this.database.user.create({

            data: {
                name: data.name,
                mobile: data.mobile,
                email: data.email,
                password: hashedPassword,
                role: data.role,
            }

        });


        return {

            message: "Registration successful",

            userId: user.id

        };

    }



    async login(data: LoginDto) {

        try {

            console.log("LOGIN REQUEST:", data);


            const user = await this.database.user.findUnique({

                where: {
                    mobile: data.mobile
                }

            });


            if (!user) {

                throw new UnauthorizedException(
                    'Invalid mobile or password'
                );

            }


            const passwordMatch = await bcrypt.compare(

                data.password,

                user.password

            );


            if (!passwordMatch) {

                throw new UnauthorizedException(
                    'Invalid mobile or password'
                );

            }



            const payload = {

                sub: user.id,

                role: user.role,

                mobile: user.mobile

            };



            // Access Token - 15 minutes

            const accessToken = await this.jwtService.signAsync(

                payload,

                {
                    expiresIn: '15m'
                }

            );



            // Refresh Token - 30 days

            const refreshToken = await this.jwtService.signAsync(

                payload,

                {

                    secret: process.env.JWT_REFRESH_SECRET,

                    expiresIn: '30d'

                }

            );



            // Store refresh token

            await this.database.user.update({

                where: {

                    id: user.id

                },

                data: {

                    refreshToken: refreshToken

                }

            });



            return {

                message: "Login successful",

                accessToken,

                refreshToken,


                user: {

                    id: user.id,

                    name: user.name,

                    mobile: user.mobile,

                    role: user.role

                }

            };


        } catch (error) {

            console.log("LOGIN ERROR:", error);

            throw error;

        }

    }




    // Refresh Access Token

    async refreshToken(token: string) {


        const user = await this.database.user.findFirst({

            where: {

                refreshToken: token

            }

        });



        if (!user) {

            throw new UnauthorizedException(
                'Invalid refresh token'
            );

        }



        const payload = {

            sub: user.id,

            role: user.role,

            mobile: user.mobile

        };



        const accessToken = await this.jwtService.signAsync(

            payload,

            {

                expiresIn: '15m'

            }

        );



        return {

            accessToken

        };

    }

}