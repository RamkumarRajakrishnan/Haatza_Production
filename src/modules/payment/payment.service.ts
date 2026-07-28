import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PaymentService {
  constructor(private db: DatabaseService) {}

  async getWalletBalance(sellerId: string) {
    let wallet = await this.db.wallet.findUnique({ where: { sellerId } });
    if (!wallet) {
      wallet = await this.db.wallet.create({ data: { sellerId, balance: 0.0 } });
    }
    return wallet;
  }

  async getTransactions(walletId: string) {
    return this.db.walletTransaction.findMany({ where: { walletId } });
  }

  async createRazorpayOrder(amount: number) {
    return {
      orderId: `rzp_order_${Date.now()}`,
      amount,
      currency: 'INR',
      status: 'created',
    };
  }

  async verifyRazorpayPayment(payload: any) {
    return { success: true, paymentId: payload.paymentId || `pay_${Date.now()}` };
  }

  async getSellerPayments(sellerId: string) {
    const wallet = await this.getWalletBalance(sellerId);
    return this.getTransactions(wallet.id);
  }

  async addFunds(walletId: string, amount: number) {
    await this.db.walletTransaction.create({
      data: { walletId, amount, type: 'CREDIT', description: 'Top up wallet' },
    });
    return this.db.wallet.update({ where: { id: walletId }, data: { balance: { increment: amount } } });
  }

  async updateWallet(sellerId: string, amount: number) {
    const wallet = await this.getWalletBalance(sellerId);
    return this.db.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
  }

  async getSettlementSummary(sellerId: string) {
    return {
      sellerId,
      totalSettled: 45000.0,
      nextSettlementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      pendingPayout: 3200.0,
    };
  }

  async createInvoice(data: any) {
    return this.db.invoice.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        invoiceNo: `INV-${Date.now()}`,
        amount: Number(data.amount) || 500,
        taxAmount: Number(data.taxAmount) || 90,
        pdfUrl: `https://cdn.haatza.com/invoices/inv-${Date.now()}.pdf`,
      },
    });
  }

  async getInvoices(sellerId: string) {
    return this.db.invoice.findMany({ where: { sellerId } });
  }
}
