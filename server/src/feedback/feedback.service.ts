import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const count = items.length;
    const avg = count
      ? Math.round((items.reduce((s, f) => s + f.rating, 0) / count) * 10) / 10
      : 0;
    const distribution = [1, 2, 3, 4, 5].map((r) => ({
      rating: r,
      count: items.filter((f) => f.rating === r).length,
    }));
    return { count, avg, distribution, items };
  }
}
