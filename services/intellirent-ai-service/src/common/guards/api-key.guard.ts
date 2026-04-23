import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const configuredApiKey =
      this.configService.get<string>('AI_SERVICE_API_KEY') || '';

    if (!configuredApiKey) {
      throw new UnauthorizedException('AI service API key is not configured');
    }

    const authHeader = request.headers.authorization || '';
    const expectedHeader = `Bearer ${configuredApiKey}`;

    if (authHeader !== expectedHeader) {
      throw new UnauthorizedException('Invalid AI service API key');
    }

    return true;
  }
}
