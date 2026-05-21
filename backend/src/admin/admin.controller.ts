import { Controller, Get, Post, UseGuards, Req, UnauthorizedException, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  getDashboardAnalytics(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view analytics');
    }
    return this.adminService.getDashboardAnalytics();
  }

  @UseGuards(JwtAuthGuard)
  @Get('analytics')
  getAnalytics(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view analytics');
    }
    return this.adminService.getAnalytics();
  }

  @UseGuards(JwtAuthGuard)
  @Get('revenue')
  getRevenue(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view revenue');
    }
    return this.adminService.getRevenue();
  }

  @UseGuards(JwtAuthGuard)
  @Get('revenue-analytics')
  getRevenueAnalytics(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view revenue analytics');
    }
    return this.adminService.getRevenueAnalytics(from, to);
  }

  @UseGuards(JwtAuthGuard)
  @Get('revenue-presets')
  getRevenuePresets(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view revenue presets');
    }
    return this.adminService.getRevenuePresets();
  }

  @UseGuards(JwtAuthGuard)
  @Get('revenue-chart')
  getRevenueChart(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view revenue chart');
    }
    return this.adminService.getRevenueChart(from, to);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bills')
  getBillsHistory(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view bills');
    }
    return this.adminService.getBillsHistory();
  }

  @UseGuards(JwtAuthGuard)
  @Get('audit-logs')
  getAuditLogs(
    @Req() req: any, 
    @Query('action') action?: string, 
    @Query('startDate') startDate?: string, 
    @Query('endDate') endDate?: string, 
    @Query('page') page?: string
  ) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
      throw new UnauthorizedException('Only admins can view audit logs');
    }
    return this.adminService.getAuditLogs({ 
      page: page ? parseInt(page) : 1 
    });
  }

  @Post('cleanup-database')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  cleanupDatabase() {
    return this.adminService.cleanupDatabase();
  }

  @Post('force-clean')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  forceClean(@Req() req: any) {
    return this.adminService.forceClean();
  }
}
