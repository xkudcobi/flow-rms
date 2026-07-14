import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './jwt-auth.guard';

// Handler parametresinde @CurrentUser() ile giriş yapmış kullanıcıyı verir.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
