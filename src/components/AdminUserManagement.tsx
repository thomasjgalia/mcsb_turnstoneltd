// ============================================================================
// Admin User Management Component
// ============================================================================
// Provides admin panel for managing users, approvals, and viewing audit logs
// ============================================================================

import { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  getAdminUsers,
  approveUser,
  suspendUser,
  deleteUser,
  getAdminAuditLog,
} from '../lib/api';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type {
  AdminUserListItem,
  AdminAuditLogEntry,
  AdminUsersResponse,
  AdminAuditLogResponse,
} from '../lib/types';

export default function AdminUserManagement() {
  // User list state
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Audit log state
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    userId: string;
    email: string;
  } | null>(null);

  // Load users on mount and when filters change
  useEffect(() => {
    loadUsers();
  }, [currentPage, searchTerm, statusFilter]);

  // Load audit log when panel is opened
  useEffect(() => {
    if (showAuditLog) {
      loadAuditLog();
    }
  }, [showAuditLog, auditPage]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response: AdminUsersResponse = await getAdminUsers(
        currentPage,
        20,
        searchTerm,
        statusFilter
      );
      setUsers(response.users);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    setLoadingAudit(true);
    try {
      const response: AdminAuditLogResponse = await getAdminAuditLog(auditPage, 20);
      setAuditLogs(response.logs);
      setAuditTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Failed to load audit log:', error);
      alert('Failed to load audit log. Please try again.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleApprove = async (userId: string, email: string) => {
    try {
      await approveUser(userId);
      alert(`User ${email} approved successfully`);
      loadUsers(); // Reload users
    } catch (error) {
      console.error('Failed to approve user:', error);
      alert('Failed to approve user. Please try again.');
    }
  };

  const handleSuspend = async (userId: string, email: string) => {
    const reason = prompt(`Suspend user ${email}?\n\nReason (optional):`);
    if (reason === null) return; // Cancelled

    try {
      await suspendUser(userId, reason);
      alert(`User ${email} suspended successfully`);
      loadUsers(); // Reload users
    } catch (error) {
      console.error('Failed to suspend user:', error);
      alert('Failed to suspend user. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;

    const reason = prompt(
      `Delete user ${deleteModal.email}?\n\nThis action cannot be undone.\n\nReason (optional):`
    );
    if (reason === null) return; // Cancelled

    try {
      await deleteUser(deleteModal.userId, reason);
      alert(`User ${deleteModal.email} deleted successfully`);
      setDeleteModal(null);
      loadUsers(); // Reload users
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage user approvals, permissions, and access</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'approved' | 'pending');
                setCurrentPage(1); // Reset to first page on filter change
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadUsers}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.supabase_user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{user.email}</div>
                          {user.display_name && (
                            <div className="text-sm text-gray-500">{user.display_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <User className="w-3 h-3" />
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_approved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <XCircle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!user.is_approved && (
                            <button
                              onClick={() => handleApprove(user.supabase_user_id, user.email)}
                              className="text-green-600 hover:text-green-900 p-1"
                              title="Approve User"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          {user.is_approved && (
                            <button
                              onClick={() => handleSuspend(user.supabase_user_id, user.email)}
                              className="text-yellow-600 hover:text-yellow-900 p-1"
                              title="Suspend User"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setDeleteModal({
                                isOpen: true,
                                userId: user.supabase_user_id,
                                email: user.email,
                              })
                            }
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete User"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
          {showAuditLog ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showAuditLog && (
          <>
            {loadingAudit ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading audit log...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-t border-gray-200">
                No audit entries found
              </div>
            ) : (
              <>
                <div className="border-t border-gray-200 divide-y divide-gray-200">
                  {auditLogs.map((log) => {
                    let details: any = {};
                    try {
                      details = JSON.parse(log.details);
                    } catch (e) {
                      // Ignore parse errors
                    }

                    return (
                      <div key={log.id} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {log.action_type.replace(/_/g, ' ')}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Admin: <span className="font-medium">{log.admin_email}</span>
                              {log.target_email && (
                                <>
                                  {' → '}Target: <span className="font-medium">{log.target_email}</span>
                                </>
                              )}
                            </div>
                            {details.reason && (
                              <div className="text-sm text-gray-500 mt-1">
                                Reason: {details.reason}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Audit Pagination */}
                {auditTotalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Page {auditPage} of {auditTotalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                        disabled={auditPage === auditTotalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <ConfirmDeleteModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
          title={`Delete user ${deleteModal.email}?`}
          message="This action cannot be undone. All user data including saved code sets will be permanently deleted."
        />
      )}
    </div>
  );
}
