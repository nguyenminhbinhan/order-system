import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;

  const mockAdminService = {
    getDashboardAnalytics: jest.fn(),
    getAnalytics: jest.fn(),
    getRevenue: jest.fn(),
    getRevenueAnalytics: jest.fn(),
    getRevenuePresets: jest.fn(),
    getRevenueChart: jest.fn(),
    getBillsHistory: jest.fn(),
    getAuditLogs: jest.fn(),
    cleanupDatabase: jest.fn(),
    forceClean: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
