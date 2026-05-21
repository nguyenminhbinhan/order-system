import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardAnalytics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total Revenue Today
    const todaySessions = await this.prisma.tableSession.findMany({
      where: {
        startedAt: { gte: today },
        endedAt: { not: null }
      }
    });
    const totalRevenueToday = todaySessions.reduce((sum, session) => sum + Number(session.totalAmount), 0);

    // Total Orders Today
    const totalOrdersToday = await this.prisma.order.count({
      where: {
        createdAt: { gte: today },
        status: { not: 'cancelled' }
      }
    });

    // Active Tables
    const activeTables = await this.prisma.table.count({
      where: {
        status: { not: 'empty' }
      }
    });

    // Top Items
    const topItemsData = await this.prisma.orderItem.groupBy({
      by: ['menuItemId', 'name'],
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 5
    });

    const topItems = topItemsData.map(item => ({
      id: item.menuItemId,
      name: item.name,
      sold: item._sum.quantity
    }));

    // Revenue by Day (7 days)
    const revenueByDay: { date: string, revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(today);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const daySessions = await this.prisma.tableSession.findMany({
        where: {
          startedAt: { gte: start, lt: end },
          endedAt: { not: null }
        }
      });
      const dayRev = daySessions.reduce((sum, session) => sum + Number(session.totalAmount), 0);
      revenueByDay.push({
        date: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRev
      });
    }

    return {
      totalRevenueToday,
      totalOrdersToday,
      activeTables,
      topItems,
      revenueByDay
    };
  }

  async getAnalytics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = await this.prisma.tableSession.findMany({
      where: { startedAt: { gte: today }, endedAt: { not: null } }
    });
    
    const revenueByHour: number[] = Array(24).fill(0);
    todaySessions.forEach(session => {
      const hour = (session.paidAt || session.startedAt).getHours();
      revenueByHour[hour] += Number(session.totalAmount || 0);
    });

    const ordersByTableMap = new Map<string, number>();
    const allOrdersLabelled = await this.prisma.order.findMany({
      where: { createdAt: { gte: today }, status: { not: 'cancelled' } },
      include: { table: true }
    });
    allOrdersLabelled.forEach(order => {
      const tableName = order.table?.name?.replace('Table', '').trim() || order.tableId.toString();
      ordersByTableMap.set(tableName, (ordersByTableMap.get(tableName) || 0) + 1);
    });
    const ordersByTable = Array.from(ordersByTableMap.entries()).map(([name, count]) => ({
      tableName: name,
      orders: count
    }));

    const topItemsData = await this.prisma.orderItem.groupBy({
      by: ['menuItemId', 'name'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    });
    const topItems = topItemsData.map(item => ({
      id: item.menuItemId,
      name: item.name,
      sold: item._sum.quantity
    }));

    return {
      revenueByHour,
      ordersByTable,
      topItems
    };
  }

  async getRevenue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = await this.prisma.tableSession.findMany({
      where: {
        startedAt: { gte: today },
      },
      include: { table: true }
    });

    const totalSessions = todaySessions.length;
    const totalRevenue = todaySessions.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

    const revenueByTableMap = new Map<string, number>();
    todaySessions.forEach(session => {
      const tableName = session.table?.name || 'Unknown Table';
      const current = revenueByTableMap.get(tableName) || 0;
      revenueByTableMap.set(tableName, current + Number(session.totalAmount || 0));
    });

    const revenueByTable = Array.from(revenueByTableMap.entries()).map(([name, revenue]) => ({
      tableName: name,
      revenue
    }));

    return {
      totalRevenue,
      totalSessions,
      revenueByTable
    };
  }

  async getRevenueAnalytics(from?: string, to?: string) {
    const where: any = {
      endedAt: { not: null },
      paidAt: { not: null },
    };

    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        where.paidAt.lte = endDate;
      }
    }

    const sessions = await this.prisma.tableSession.findMany({
      where,
      select: { totalAmount: true, paidAt: true }
    });

    const totalRevenue = sessions.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const totalOrders = sessions.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue,
    };
  }

  async getRevenuePresets() {
    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // This year
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todaySessions, monthSessions, yearSessions] = await Promise.all([
      this.prisma.tableSession.findMany({
        where: { paidAt: { gte: todayStart, not: null }, endedAt: { not: null } },
        select: { totalAmount: true }
      }),
      this.prisma.tableSession.findMany({
        where: { paidAt: { gte: monthStart, not: null }, endedAt: { not: null } },
        select: { totalAmount: true }
      }),
      this.prisma.tableSession.findMany({
        where: { paidAt: { gte: yearStart, not: null }, endedAt: { not: null } },
        select: { totalAmount: true }
      })
    ]);

    const sumSessions = (sessions: { totalAmount: any }[]) =>
      sessions.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

    return {
      today: { totalRevenue: sumSessions(todaySessions), totalOrders: todaySessions.length },
      month: { totalRevenue: sumSessions(monthSessions), totalOrders: monthSessions.length },
      year:  { totalRevenue: sumSessions(yearSessions), totalOrders: yearSessions.length },
    };
  }

  async getRevenueChart(from?: string, to?: string) {
    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = to ? new Date(to) : now;
    endDate.setHours(23, 59, 59, 999);

    const sessions = await this.prisma.tableSession.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate, not: null },
        endedAt: { not: null },
      },
      select: { totalAmount: true, paidAt: true }
    });

    // Group by day
    const dailyMap = new Map<string, number>();
    for (const s of sessions) {
      if (!s.paidAt) continue;
      const dayKey = s.paidAt.toISOString().slice(0, 10); // YYYY-MM-DD
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + Number(s.totalAmount || 0));
    }

    // Fill gaps for all dates in range
    const labels: string[] = [];
    const data: number[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = cursor.toISOString().slice(0, 10);
      labels.push(key);
      data.push(dailyMap.get(key) || 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    return { labels, data };
  }

  async getBillsHistory() {
    const sessions = await this.prisma.tableSession.findMany({
      where: { endedAt: { not: null } },
      orderBy: { endedAt: 'desc' },
      include: { table: true, orders: { include: { items: true } } }
    });
    
    return sessions.map(session => {
       const items: any[] = [];
       for (const order of session.orders) {
          if (order.status !== 'cancelled') {
             for (const item of order.items) {
                if (item.status === 'ready') {
                   items.push(item);
                }
             }
          }
       }
       const total = Number(session.totalAmount || 0);
       const subtotal = total;
       
       return {
         sessionId: session.id,
         tableId: session.tableId,
         tableNumber: session.table?.name?.replace('Table', '').trim() || session.tableId,
         startedAt: session.startedAt,
         endedAt: session.endedAt,
         items,
         subtotal,
         total,
         billPrinted: (session as any).billPrinted || false
       };
    });
  }

  async getAuditLogs(filters: { action?: string, startDate?: string, endDate?: string, page: number }) {
    const take = 50;
    const skip = (filters.page - 1) * take;

    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, email: true, role: true } } }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      data: logs,
      meta: {
        total,
        page: filters.page,
        lastPage: Math.ceil(total / take)
      }
    };
  }

  async cleanupDatabase() {
    const sessions = await this.prisma.tableSession.findMany({
      where: { endedAt: null },
      include: { orders: true }
    });

    let cleaned = 0;

    for (const s of sessions) {
      if (!s.orders || s.orders.length === 0) {
        await this.prisma.tableSession.update({
          where: { id: s.id },
          data: { endedAt: new Date(), totalAmount: 0 }
        });
        cleaned++;
      }
    }

    return {
      success: true,
      cleanedSessions: cleaned
    };
  }

  async forceCloseBrokenSessions() {
    const sessions = await this.prisma.tableSession.findMany({
      where: { endedAt: null },
      include: { orders: true }
    });

    for (const s of sessions) {
      if (s.orders.length === 0) {
        console.warn("CLOSING EMPTY SESSION:", s.id);

        await this.prisma.tableSession.update({
          where: { id: s.id },
          data: { endedAt: new Date() }
        });
      }
    }
  }

  async forceClean() {
    await this.forceCloseBrokenSessions();
    return { success: true };
  }
}
