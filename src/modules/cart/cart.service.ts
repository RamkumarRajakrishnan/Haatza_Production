import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CartItem {
  productId: string;
  quantity: number;
  price?: number;
}

@Injectable()
export class CartService {
  private cartStore = new Map<string, CartItem[]>();

  constructor(private readonly db: DatabaseService) {}

  async getCart(userId: string) {
    const items = this.cartStore.get(userId) || [];
    return {
      userId,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async addItem(userId: string, item: CartItem) {
    const items = this.cartStore.get(userId) || [];
    const existingIndex = items.findIndex((i) => i.productId === item.productId);

    if (existingIndex > -1) {
      items[existingIndex].quantity += item.quantity || 1;
    } else {
      items.push({ productId: item.productId, quantity: item.quantity || 1, price: item.price });
    }

    this.cartStore.set(userId, items);
    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, productId: string, quantity: number) {
    let items = this.cartStore.get(userId) || [];
    if (quantity <= 0) {
      items = items.filter((i) => i.productId !== productId);
    } else {
      const item = items.find((i) => i.productId === productId);
      if (item) {
        item.quantity = quantity;
      }
    }
    this.cartStore.set(userId, items);
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const items = (this.cartStore.get(userId) || []).filter((i) => i.productId !== productId);
    this.cartStore.set(userId, items);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    this.cartStore.delete(userId);
    return { userId, items: [], itemCount: 0 };
  }
}
