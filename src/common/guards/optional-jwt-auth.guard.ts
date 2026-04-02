import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      return Boolean(result);
    } catch {
      return true;
    }
  }

  handleRequest(err: unknown, user: unknown) {
    if (err || !user) {
      return null;
    }

    return user;
  }
}
