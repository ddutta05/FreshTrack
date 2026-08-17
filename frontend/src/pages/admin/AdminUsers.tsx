import { useEffect, useState } from 'react';
import { Users, Ban, Eye, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import { LoadingSpinner, EmptyState, ErrorState, TableRowSkeleton } from '@/components/common/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import { userService } from '@/services/services';
import type { User } from '@/types';

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    userService
      .getAll()
      .then((data) => setUsers(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDisable = async (userId: string) => {
    try {
      await userService.disable(userId);
      const updated = await userService.getAll();
      setUsers(updated);
      toast('User status updated.', 'success');
    } catch {
      toast('Failed to update user status.', 'error');
    }
  };

  const openUser = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">Manage all platform users.</p>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <TableRowSkeleton cols={6} />
            </tbody>
          </table>
        </div>
      ) : error ? (
        <ErrorState message="Failed to load users. Please try again." onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" message="No users match your search." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      {u.organizationName && <p className="text-xs text-gray-500">{u.organizationName}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${u.status === 'active' ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-700'}`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openUser(u)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {u.role !== 'admin' && (
                          <Button size="sm" variant="danger" onClick={() => handleDisable(u.id)}>
                            <Ban className="w-4 h-4" /> {u.status === 'disabled' ? 'Enable' : 'Disable'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="User Details"
        footer={<Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>}
      >
        {selectedUser && (
          <div className="space-y-3">
            <DetailRow label="Name" value={selectedUser.name} />
            <DetailRow label="Email" value={selectedUser.email} />
            <DetailRow label="Role" value={selectedUser.role} />
            <DetailRow label="Phone" value={selectedUser.phone || 'N/A'} />
            {selectedUser.organizationName && <DetailRow label="Organization" value={selectedUser.organizationName} />}
            <DetailRow label="Status" value={selectedUser.status || 'active'} />
            <DetailRow label="Joined" value={selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'} />
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 capitalize">{value}</span>
    </div>
  );
}
