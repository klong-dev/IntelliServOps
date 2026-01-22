import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): { message: string; version: string; timestamp: string } {
    return {
      message: `Welcome to ${this.configService.get('app.name')} API`,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
