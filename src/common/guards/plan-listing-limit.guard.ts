import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SubscriptionService } from '../../modules/subscription/subscription.service';

@Injectable()
export class PlanListingLimitGuard implements CanActivate {
  private readonly logger = new Logger(PlanListingLimitGuard.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const sellerId = user?.sellerId || user?.id || 'UNKNOWN_SELLER';

    try {
      const usage = await this.subscriptionService.getPlanUsage(sellerId);

      if (usage && usage.data) {
        const { currentListings, maxListings, planName } = usage.data;

        if (currentListings >= maxListings) {
          this.logger.warn(
            `Seller ${sellerId} reached plan listing limit (${currentListings}/${maxListings}) on ${planName} plan.`,
          );

          throw new ForbiddenException(
            `Plan listing limit reached (${maxListings} product listings max on ${planName} plan). Upgrade your Grow Plan to list more products.`,
          );
        }
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Error in PlanListingLimitGuard: ${error.message}`);
    }

    return true;
  }
}
