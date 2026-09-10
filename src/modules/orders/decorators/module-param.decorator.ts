import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/**
 * Custom @ModuleParam() decorator.
 * Extracts the `module` query parameter (or body fallback if sent in body).
 * Strictly validates that it is exactly 'haatza' or 'lite' (case-sensitive).
 * Any other value ('Haatza', 'HAATZA', 'Lite', undefined, etc.) triggers a 400 Bad Request.
 */
export const ModuleParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): 'haatza' | 'lite' => {
    const request = ctx.switchToHttp().getRequest();
    const queryModule = request.query?.module;
    const bodyModule = request.body?.module;
    const module = queryModule !== undefined ? queryModule : bodyModule;

    if (module === undefined || module === null || module === '') {
      throw new BadRequestException({
        status: 'error',
        message: 'module is required',
      });
    }

    if (typeof module !== 'string' || (module !== 'haatza' && module !== 'lite')) {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid module. Allowed values are haatza or lite.',
      });
    }

    return module;
  },
);
