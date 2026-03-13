import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Persona } from '../../personas/entities/persona.entity';

interface AuthenticatedRequest extends Request {
  user?: Persona;
}

/**
 * Parameter decorator to extract the current authenticated user from request
 * Can optionally extract a specific property from the user
 *
 * @example
 * // Get full user object
 * @CurrentUser() user: Persona
 *
 * // Get specific property
 * @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof Persona | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
