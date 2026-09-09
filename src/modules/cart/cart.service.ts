import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartQuantityDto } from './dto/update-cart-quantity.dto';
import { CartItemActionDto } from './dto/cart-item-action.dto';

const VALID_MODULES = new Set(['haatza', 'HAATZA', 'Haatza', 'lite', 'LITE', 'Lite']);

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  /**
   * Validate the module query parameter strictly with case sensitivity.
   * Allowed values: haatza, HAATZA, Haatza, lite, LITE, Lite.
   */
  public validateModule(module?: string): string {
    if (!module || typeof module !== 'string' || !VALID_MODULES.has(module.trim())) {
      throw new BadRequestException('Invalid module. Supported modules are haatza and lite.');
    }
    return module.trim();
  }

  /**
   * Convert database cart row to camelCase response format.
   */
  public formatCartItem(item: any) {
    if (!item) return null;
    return {
      id: item.id,
      cartId: item.cartId ?? item.cart_id,
      userId: item.userId ?? item.user_id,
      productId: item.productId ?? item.product_id,
      sellerId: item.sellerId ?? item.seller_id ?? '',
      variantId:
        item.variantId !== null && item.variantId !== undefined
          ? item.variantId
          : item.variant_id ?? '',
      quantity:
        typeof item.quantity === 'number'
          ? item.quantity
          : Number(item.quantity || 1),
      priceAtAddedTime:
        typeof item.priceAtAddedTime === 'number'
          ? item.priceAtAddedTime
          : Number(
              item.priceAtAddedTime?.toString() ||
                item.price_at_added_time?.toString() ||
                0,
            ),
      discountAtAddedTime:
        typeof item.discountAtAddedTime === 'number'
          ? item.discountAtAddedTime
          : Number(
              item.discountAtAddedTime?.toString() ||
                item.discount_at_added_time?.toString() ||
                0,
            ),
      deliveryEstimate: item.deliveryEstimate ?? item.delivery_estimate ?? null,
      moveToWishlist: Boolean(item.moveToWishlist ?? item.move_to_wishlist),
      addedAt: item.addedAt ?? item.added_at,
      updatedAt: item.updatedAt ?? item.updated_at,
    };
  }

  /**
   * Find an existing cart_id for the user or generate a new one.
   */
  private async resolveCartId(userId: string): Promise<string> {
    const existing = await this.databaseService.cart.findFirst({
      where: { userId },
      select: { cartId: true },
      orderBy: { addedAt: 'desc' },
    });

    if (existing?.cartId) {
      return existing.cartId;
    }

    return `CART_${Date.now()}`;
  }

  /**
   * Add a product to Cart (move_to_wishlist = false).
   * If already present in Cart, increments quantity by 1.
   */
  async addToCart(dto: AddToCartDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId ? dto.variantId.trim() : '';
    const cartId = await this.resolveCartId(dto.userId);

    const variantCondition = effectiveVariantId
      ? { variantId: effectiveVariantId }
      : {
          OR: [{ variantId: null }, { variantId: '' }],
        };

    const existingItem = await this.databaseService.cart.findFirst({
      where: {
        userId: dto.userId,
        productId: dto.productId,
        moveToWishlist: false,
        ...variantCondition,
      },
    });

    if (existingItem) {
      const updated = await this.databaseService.cart.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + 1,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Product added to cart successfully.',
        data: this.formatCartItem(updated),
      };
    }

    const created = await this.databaseService.cart.create({
      data: {
        cartId,
        userId: dto.userId,
        productId: dto.productId,
        sellerId: dto.sellerId,
        variantId: effectiveVariantId || null,
        quantity: 1,
        priceAtAddedTime: dto.priceAtAddedTime ?? 0,
        discountAtAddedTime: dto.discountAtAddedTime ?? 0,
        moveToWishlist: false,
      },
    });

    return {
      success: true,
      message: 'Product added to cart successfully.',
      data: this.formatCartItem(created),
    };
  }

  /**
   * Add a product to Wishlist (move_to_wishlist = true).
   * Stores row in the SAME cart table.
   * If already present in Wishlist, does not create a duplicate.
   */
  async addToWishlist(dto: AddToCartDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId ? dto.variantId.trim() : '';
    const cartId = await this.resolveCartId(dto.userId);

    const variantCondition = effectiveVariantId
      ? { variantId: effectiveVariantId }
      : {
          OR: [{ variantId: null }, { variantId: '' }],
        };

    const existingItem = await this.databaseService.cart.findFirst({
      where: {
        userId: dto.userId,
        productId: dto.productId,
        moveToWishlist: true,
        ...variantCondition,
      },
    });

    if (existingItem) {
      return {
        success: true,
        message: 'Product is already in wishlist.',
        data: this.formatCartItem(existingItem),
      };
    }

    const created = await this.databaseService.cart.create({
      data: {
        cartId,
        userId: dto.userId,
        productId: dto.productId,
        sellerId: dto.sellerId,
        variantId: effectiveVariantId || null,
        quantity: 1,
        priceAtAddedTime: dto.priceAtAddedTime ?? 0,
        discountAtAddedTime: dto.discountAtAddedTime ?? 0,
        moveToWishlist: true,
      },
    });

    return {
      success: true,
      message: 'Product added to wishlist successfully.',
      data: this.formatCartItem(created),
    };
  }

  /**
   * Update quantity of a cart item (move_to_wishlist = false).
   * If quantity <= 0, deletes the row.
   */
  async updateQuantity(dto: UpdateCartQuantityDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId !== undefined ? dto.variantId.trim() : undefined;

    const existingItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: false,
        ...(effectiveVariantId !== undefined
          ? effectiveVariantId
            ? { variantId: effectiveVariantId }
            : { OR: [{ variantId: null }, { variantId: '' }] }
          : {}),
      },
    });

    if (!existingItem) {
      return {
        success: false,
        message: 'Cart item not found.',
      };
    }

    if (dto.quantity <= 0) {
      await this.databaseService.cart.delete({
        where: { id: existingItem.id },
      });

      return {
        success: true,
        message: 'Cart item removed successfully.',
      };
    }

    const updated = await this.databaseService.cart.update({
      where: { id: existingItem.id },
      data: {
        quantity: dto.quantity,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Cart quantity updated successfully.',
      data: this.formatCartItem(updated),
    };
  }

  /**
   * Remove an item from cart (move_to_wishlist = false).
   * Does NOT affect wishlist rows.
   */
  async removeFromCart(dto: CartItemActionDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId !== undefined ? dto.variantId.trim() : undefined;

    const existingItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: false,
        ...(effectiveVariantId !== undefined
          ? effectiveVariantId
            ? { variantId: effectiveVariantId }
            : { OR: [{ variantId: null }, { variantId: '' }] }
          : {}),
      },
    });

    if (!existingItem) {
      return {
        success: false,
        message: 'Cart item not found.',
      };
    }

    await this.databaseService.cart.delete({
      where: { id: existingItem.id },
    });

    return {
      success: true,
      message: 'Product removed from cart successfully.',
    };
  }

  /**
   * Move an item from Cart to Wishlist.
   * Updates move_to_wishlist = true in the SAME table.
   * Prevents duplicates if the product is already in the wishlist.
   */
  async moveToWishlist(dto: CartItemActionDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId !== undefined ? dto.variantId.trim() : undefined;

    const cartItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: false,
        ...(effectiveVariantId !== undefined
          ? effectiveVariantId
            ? { variantId: effectiveVariantId }
            : { OR: [{ variantId: null }, { variantId: '' }] }
          : {}),
      },
    });

    if (!cartItem) {
      return {
        success: false,
        message: 'Cart item not found.',
      };
    }

    // Check if item already exists in wishlist
    const variantCondition = cartItem.variantId
      ? { variantId: cartItem.variantId }
      : { OR: [{ variantId: null }, { variantId: '' }] };

    const existingWishlist = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: true,
        ...variantCondition,
      },
    });

    if (existingWishlist) {
      // Remove cart item to avoid duplicates, return existing wishlist item
      await this.databaseService.cart.delete({
        where: { id: cartItem.id },
      });

      return {
        success: true,
        message: 'Product moved to wishlist successfully.',
        data: this.formatCartItem(existingWishlist),
      };
    }

    // Update in-place in same table
    const updated = await this.databaseService.cart.update({
      where: { id: cartItem.id },
      data: {
        moveToWishlist: true,
        quantity: 1,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Product moved to wishlist successfully.',
      data: this.formatCartItem(updated),
    };
  }

  /**
   * Move an item from Wishlist to Cart.
   * Updates move_to_wishlist = false in the SAME table.
   * If item already exists in Cart, increments quantity and cleans up wishlist row.
   */
  async moveToCart(dto: CartItemActionDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId !== undefined ? dto.variantId.trim() : undefined;

    const wishlistItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: true,
        ...(effectiveVariantId !== undefined
          ? effectiveVariantId
            ? { variantId: effectiveVariantId }
            : { OR: [{ variantId: null }, { variantId: '' }] }
          : {}),
      },
    });

    if (!wishlistItem) {
      return {
        success: false,
        message: 'Wishlist item not found.',
      };
    }

    // Check if product already exists in Cart
    const variantCondition = wishlistItem.variantId
      ? { variantId: wishlistItem.variantId }
      : { OR: [{ variantId: null }, { variantId: '' }] };

    const existingCartItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: false,
        ...variantCondition,
      },
    });

    if (existingCartItem) {
      // Increment existing cart item quantity by 1, delete wishlist row
      const updatedCart = await this.databaseService.cart.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + 1,
          updatedAt: new Date(),
        },
      });

      await this.databaseService.cart.delete({
        where: { id: wishlistItem.id },
      });

      return {
        success: true,
        message: 'Product moved to cart successfully.',
        data: this.formatCartItem(updatedCart),
      };
    }

    // Update in-place to cart item
    const updated = await this.databaseService.cart.update({
      where: { id: wishlistItem.id },
      data: {
        moveToWishlist: false,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Product moved to cart successfully.',
      data: this.formatCartItem(updated),
    };
  }

  /**
   * Remove an item from Wishlist (move_to_wishlist = true).
   * Does NOT affect cart rows.
   */
  async removeFromWishlist(dto: CartItemActionDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId !== undefined ? dto.variantId.trim() : undefined;

    const existingItem = await this.databaseService.cart.findFirst({
      where: {
        cartId: dto.cartId,
        productId: dto.productId,
        moveToWishlist: true,
        ...(effectiveVariantId !== undefined
          ? effectiveVariantId
            ? { variantId: effectiveVariantId }
            : { OR: [{ variantId: null }, { variantId: '' }] }
          : {}),
      },
    });

    if (!existingItem) {
      return {
        success: false,
        message: 'Wishlist item not found.',
      };
    }

    await this.databaseService.cart.delete({
      where: { id: existingItem.id },
    });

    return {
      success: true,
      message: 'Product removed from wishlist successfully.',
    };
  }
}
