import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { map, Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      let result = true;
      try {
        const res = super.canActivate(context);
        if (typeof res == 'boolean') result = true;
        else if (res instanceof Observable) {
          return res.pipe(map((ans) => ans || true));
        } else if (res instanceof Promise) {
          return res.then((ans) => ans || true).catch(() => true);
        }
      } finally {
        result = true;
      }
      return result;
    }
    return super.canActivate(context);
  }
}
