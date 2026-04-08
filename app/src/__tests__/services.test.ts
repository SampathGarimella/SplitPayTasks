/**
 * Integration test stubs for service layer.
 * These tests verify the service interface contracts.
 * For full integration tests, set up a Supabase test instance.
 */

import * as groupService from '../services/groupService';
import * as expenseService from '../services/expenseService';
import * as taskService from '../services/taskService';
import * as notificationService from '../services/notificationService';

// Mock Supabase
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('Service Layer Interface Tests', () => {
  describe('groupService', () => {
    it('exports createGroup function', () => {
      expect(typeof groupService.createGroup).toBe('function');
    });

    it('exports getGroups function', () => {
      expect(typeof groupService.getGroups).toBe('function');
    });

    it('exports joinGroupByCode function', () => {
      expect(typeof groupService.joinGroupByCode).toBe('function');
    });

    it('exports leaveGroup function', () => {
      expect(typeof groupService.leaveGroup).toBe('function');
    });
  });

  describe('expenseService', () => {
    it('exports createExpense function', () => {
      expect(typeof expenseService.createExpense).toBe('function');
    });

    it('exports getExpenses function', () => {
      expect(typeof expenseService.getExpenses).toBe('function');
    });

    it('exports getBalances function', () => {
      expect(typeof expenseService.getBalances).toBe('function');
    });

    it('exports simplifyDebts function', () => {
      expect(typeof expenseService.simplifyDebts).toBe('function');
    });

    it('exports createSettlement function', () => {
      expect(typeof expenseService.createSettlement).toBe('function');
    });
  });

  describe('taskService', () => {
    it('exports createTask function', () => {
      expect(typeof taskService.createTask).toBe('function');
    });

    it('exports getTasks function', () => {
      expect(typeof taskService.getTasks).toBe('function');
    });

    it('exports completeTask function', () => {
      expect(typeof taskService.completeTask).toBe('function');
    });

    it('exports skipTask function', () => {
      expect(typeof taskService.skipTask).toBe('function');
    });
  });

  describe('notificationService', () => {
    it('exports getNotifications function', () => {
      expect(typeof notificationService.getNotifications).toBe('function');
    });

    it('exports markAsRead function', () => {
      expect(typeof notificationService.markAsRead).toBe('function');
    });

    it('exports markAllAsRead function', () => {
      expect(typeof notificationService.markAllAsRead).toBe('function');
    });
  });
});
