import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  Logger,
  Inject,
} from '@nestjs/common';
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
   * Strictly validate the module query parameter for Get Cart & Get Wishlist APIs.
   * Case-sensitive: ONLY 'haatza' and 'lite' are allowed.
   */
  public validateGetModule(module?: string): 'haatza' | 'lite' {
    if (module === undefined || module === null || module === '') {
      throw new BadRequestException({
        status: 'error',
        message: 'module is required',
      });
    }
    if (module !== 'haatza' && module !== 'lite') {
      throw new BadRequestException({
        status: 'error',
        message: 'Invalid module. Allowed values are haatza or lite.',
      });
    }
    return module;
  }

  /**
   * Strictly validate the userId query parameter for Get Cart & Get Wishlist APIs.
   */
  public validateGetUserId(userId?: string): string {
    if (userId === undefined || userId === null || typeof userId !== 'string' || userId.trim() === '') {
      throw new BadRequestException({
        status: 'error',
        message: 'userId is required',
      });
    }
    return userId.trim();
  }

  /**
   * Map database cart row to frontend camelCase line item structure.
   */
  public transformCartRowToLineItem(item: any) {
    return {
      id: item.id,
      productId: item.productId ?? item.product_id,
      variantId:
        item.variantId !== null && item.variantId !== undefined
          ? item.variantId
          : (item.variant_id ?? null),
      sellerId: item.sellerId ?? item.seller_id ?? null,
      quantity:
        typeof item.quantity === 'number'
          ? item.quantity
          : Number(item.quantity || 1),
      price:
        typeof item.priceAtAddedTime === 'number'
          ? item.priceAtAddedTime
          : Number(
              item.priceAtAddedTime?.toString() ||
                item.price_at_added_time?.toString() ||
                0,
            ),
      discount:
        typeof item.discountAtAddedTime === 'number'
          ? item.discountAtAddedTime
          : Number(
              item.discountAtAddedTime?.toString() ||
                item.discount_at_added_time?.toString() ||
                0,
            ),
      deliveryEstimate: item.deliveryEstimate ?? item.delivery_estimate ?? null,
      addedAt:
        item.addedAt instanceof Date
          ? item.addedAt.toISOString()
          : (item.added_at ?? item.addedAt),
      updatedAt:
        item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : (item.updated_at ?? item.updatedAt),
    };
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
   * Resolves the deterministic, permanent 1:1 cartId for a user.
   * 1 User = Always the exact same 1 Cart ID (CART_<userId>).
   */
  public resolveCartId(userId: string): string {
    const cleanUserId = (userId || '').trim();
    return cleanUserId.startsWith('CART_') ? cleanUserId : `CART_${cleanUserId}`;
  }

  /**
   * Resolves the deterministic, permanent 1:1 wishlistId for a user.
   * 1 User = Always the exact same 1 Wishlist ID (WISHLIST_<userId>).
   */
  public resolveWishlistId(userId: string): string {
    const cleanUserId = (userId || '').trim();
    return cleanUserId.startsWith('WISHLIST_') ? cleanUserId : `WISHLIST_${cleanUserId}`;
  }

  /**
   * Helper to build cartId matching condition supporting CART_<userId>, WISHLIST_<userId>, and <userId>.
   */
  private getCartIdWhereCondition(cartId: string) {
    const trimmed = (cartId || '').trim();
    const rawUserId = trimmed.replace(/^(CART_|WISHLIST_)/, '');
    const candidateIds = Array.from(
      new Set([
        trimmed,
        `CART_${rawUserId}`,
        `WISHLIST_${rawUserId}`,
        rawUserId,
      ].filter(Boolean)),
    );

    return candidateIds.length === 1
      ? { cartId: candidateIds[0] }
      : { cartId: { in: candidateIds } };
  }

  /**
   * Add a product to Cart (move_to_wishlist = false).
   * If already present in Cart, increments quantity by 1.
   */
  async addToCart(dto: AddToCartDto, module?: string) {
    this.validateModule(module);

    const effectiveVariantId = dto.variantId ? dto.variantId.trim() : '';
    const cartId = this.resolveCartId(dto.userId);

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
      return {
        success: true,
        message: 'Product is already in your cart.',
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
    const wishlistId = this.resolveWishlistId(dto.userId);

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
        cartId: wishlistId,
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
        ...this.getCartIdWhereCondition(dto.cartId),
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
        ...this.getCartIdWhereCondition(dto.cartId),
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
        ...this.getCartIdWhereCondition(dto.cartId),
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
        ...this.getCartIdWhereCondition(cartItem.cartId),
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
    const wishlistId = this.resolveWishlistId(cartItem.userId);
    const updated = await this.databaseService.cart.update({
      where: { id: cartItem.id },
      data: {
        cartId: wishlistId,
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
        ...this.getCartIdWhereCondition(dto.cartId),
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
        ...this.getCartIdWhereCondition(wishlistItem.cartId),
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
    const cartId = this.resolveCartId(wishlistItem.userId);
    const updated = await this.databaseService.cart.update({
      where: { id: wishlistItem.id },
      data: {
        cartId,
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
        ...this.getCartIdWhereCondition(dto.cartId),
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

  /**
   * Retrieve Cart items (move_to_wishlist = false) adhering to Wix-style camelCase response.
   */
  async getCart(params: { module?: string; userId?: string; cartId?: string }) {
    this.validateGetModule(params.module);
    const userId = this.validateGetUserId(params.userId);

    try {
      const records = await this.databaseService.cart.findMany({
        where: {
          userId,
          moveToWishlist: false,
        },
        orderBy: { addedAt: 'asc' },
      });

      if (!records || records.length === 0) {
        return {
          status: 'success',
          message: 'Cart is empty',
          data: {
            id: null,
            userId,
            lineItems: [],
            totalItems: 0,
          },
        };
      }

      const lineItems = records.map((r) => this.transformCartRowToLineItem(r));
      const cartId = this.resolveCartId(userId);

      return {
        status: 'success',
        message: 'Cart fetched successfully',
        data: {
          id: cartId,
          userId,
          lineItems,
          totalItems: lineItems.length,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Unable to fetch cart for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        status: 'error',
        message: 'Unable to fetch cart',
      });
    }
  }

  /**
   * Retrieve Wishlist items (move_to_wishlist = true) adhering to Wix-style camelCase response.
   */
  async getWishlist(params: { module?: string; userId?: string; cartId?: string }) {
    this.validateGetModule(params.module);
    const userId = this.validateGetUserId(params.userId);

    try {
      const records = await this.databaseService.cart.findMany({
        where: {
          userId,
          moveToWishlist: true,
        },
        orderBy: { addedAt: 'asc' },
      });

      if (!records || records.length === 0) {
        return {
          status: 'success',
          message: 'Wishlist is empty',
          data: {
            id: null,
            userId,
            items: [],
            totalItems: 0,
          },
        };
      }

      const items = records.map((r) => this.transformCartRowToLineItem(r));
      const wishlistId = this.resolveWishlistId(userId);

      return {
        status: 'success',
        message: 'Wishlist fetched successfully',
        data: {
          id: wishlistId,
          userId,
          items,
          totalItems: items.length,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Unable to fetch wishlist for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        status: 'error',
        message: 'Unable to fetch wishlist',
      });
    }
  }

  /**
   * Helper to attach product details (name, image, current price, MRP, inventory) to cart rows.
   */
  private async enrichWithProducts(rows: any[]) {
    if (!rows || rows.length === 0) {
      return [];
    }

    const productIds = Array.from(new Set(rows.map((r) => r.productId).filter(Boolean)));

    const products =
      productIds.length > 0
        ? await this.databaseService.product.findMany({
            where: {
              OR: [
                { id: { in: productIds } },
                { productId: { in: productIds } },
              ],
            },
            select: {
              id: true,
              productId: true,
              name: true,
              mainMedia: true,
              productImages: true,
              brand: true,
              inventory: true,
              price: true,
              mrp: true,
              onsalePrice: true,
              sellerId: true,
            },
          })
        : [];

    const productMap = new Map<string, any>();
    for (const p of products) {
      if (p.id) productMap.set(p.id, p);
      if (p.productId) productMap.set(p.productId, p);
    }

    return rows.map((row) => {
      const formatted = this.formatCartItem(row) || {
        id: row.id,
        cartId: row.cart_id,
        userId: row.user_id,
        productId: row.product_id,
        sellerId: row.seller_id || '',
        variantId: row.variant_id || '',
        quantity: row.quantity || 1,
        priceAtAddedTime: 0,
        discountAtAddedTime: 0,
        deliveryEstimate: null,
        moveToWishlist: false,
        addedAt: row.added_at,
        updatedAt: row.updated_at,
      };
      const product = productMap.get(row.productId) || null;

      const currentPrice =
        typeof product?.price === 'number'
          ? product.price
          : typeof product?.onsalePrice === 'number'
            ? product.onsalePrice
            : (formatted.priceAtAddedTime ?? 0);

      const mrp =
        typeof product?.mrp === 'number'
          ? product.mrp
          : currentPrice;

      return {
        ...formatted,
        product: product
          ? {
              id: product.id,
              productId: product.productId || product.id,
              name: product.name,
              mainMedia: product.mainMedia || null,
              brand: product.brand || null,
              currentPrice,
              mrp,
              inStock: (product.inventory ?? 0) > 0,
              inventory: product.inventory ?? 0,
              sellerId: product.sellerId || formatted.sellerId,
            }
          : null,
      };
    });
  }
}
