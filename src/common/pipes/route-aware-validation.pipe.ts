import { ArgumentMetadata, Injectable, ValidationPipe } from '@nestjs/common';

/**
 * Metadata key used to mark DTOs that should bypass `forbidNonWhitelisted`
 * at the global validation pipe (see {@link RouteAwareValidationPipe}).
 */
export const LOOSE_VALIDATION_KEY = 'j-commerce:loose-validation';

/**
 * Class decorator: marks a DTO so the global RouteAwareValidationPipe
 * validates it with forbidNonWhitelisted=false (strip unknown fields
 * instead of returning 400). Used for the Midtrans webhook DTO, whose
 * payloads carry method-specific extra fields (GoPay, QRIS, card, VA,
 * refund_* and channel_response_* families, etc.) that are not — and cannot
 * be — on the DTO.
 *
 * NestJS runs global pipes before route/param-scoped pipes, so a route-scoped
 * UsePipes(ValidationPipe({ forbidNonWhitelisted: false })) cannot override
 * the global forbidNonWhitelisted=true (the global pipe runs first and
 * rejects). Marking the DTO lets the single global pipe switch profiles
 * based on the param metatype.
 */
export function LooseValidation(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(LOOSE_VALIDATION_KEY, true, target);
  };
}

/**
 * Global ValidationPipe that defaults to the strict profile
 * (whitelist + forbidNonWhitelisted + transform) used app-wide, but switches
 * to the loose profile (strip extras, no 400) for DTOs marked with
 * `@LooseValidation()`. This keeps strict 400-on-unknown-field behavior for
 * every other route while exempting the marked DTO.
 */
@Injectable()
export class RouteAwareValidationPipe extends ValidationPipe {
  private readonly loosePipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
  }

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const metatype = metadata?.metatype as object | undefined;
    if (metatype && Reflect.getMetadata(LOOSE_VALIDATION_KEY, metatype) === true) {
      return this.loosePipe.transform(value, metadata);
    }
    return super.transform(value, metadata);
  }
}