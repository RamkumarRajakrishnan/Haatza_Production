import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class HaatzUpService {
  constructor(private db: DatabaseService) {}

  async getHaatzUpProducts(sellerId: string) {
    return this.db.product.findMany({ where: { sellerId }, take: 10 });
  }

  generateHashtags(text: string) {
    return {
      hashtags: ['#HaatzaShopping', '#TrendingDeals', '#FashionStyle', '#SellerSpotlight', '#BestOffers'],
    };
  }

  async uploadVideo(data: any) {
    return this.db.haatzUpVideo.create({
      data: {
        sellerId: data.sellerId || 'seller-1',
        videoUrl: data.videoUrl || 'https://cdn.haatza.com/haatzup/video-sample.mp4',
        hashtags: data.hashtags || ['#Haatza'],
        productIds: data.productIds || [],
      },
    });
  }

  async getSellerHaatzUp(sellerId: string) {
    return this.db.haatzUpVideo.findMany({ where: { sellerId } });
  }

  async getHaatzUpDetails(videoId: string) {
    const video = await this.db.haatzUpVideo.findUnique({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video post not found');
    return video;
  }

  async deleteVideo(videoId: string) {
    return this.db.haatzUpVideo.delete({ where: { id: videoId } });
  }
}
