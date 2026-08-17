import { useEffect, useState } from 'react';
import { Package, Trash2, Eye, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import StatusBadge from '@/components/common/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState, TableRowSkeleton } from '@/components/common/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import { donationService } from '@/services/services';
import type { Donation } from '@/types';

export default function AdminDonations() {
  const { toast } = useToast();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Donation | null>(null);

  useEffect(() => {
    donationService
      .getAll()
      .then((data) => setDonations(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = donations.filter(
    (d) => d.foodName.toLowerCase().includes(search.toLowerCase()) || d.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemove = async (donation: Donation) => {
    try {
      await donationService.remove(donation.id);
      setDonations((prev) => prev.filter((d) => d.id !== donation.id));
      toast('Donation removed.', 'success');
      setConfirmDelete(null);
    } catch {
      toast('Failed to remove donation.', 'error');
    }
  };

  const openDonation = (donation: Donation) => {
    setSelectedDonation(donation);
    setShowModal(true);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Donations</h1>
        <p className="text-gray-500 mt-1">Manage all food donations on the platform.</p>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Search by food name or location..."
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Food</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Donor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Posted</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <TableRowSkeleton cols={6} />
            </tbody>
          </table>
        </div>
      ) : error ? (
        <ErrorState message="Failed to load donations. Please try again." onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No donations found" message="No donations match your search." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Food</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Donor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Posted</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={d.image} alt={d.foodName} className="w-full h-full object-cover" />
                        </div>
                        <p className="font-medium text-gray-900">{d.foodName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">{d.donorName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{d.location}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openDonation(d)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(d)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Donation Details"
        footer={<Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>}
      >
        {selectedDonation && (
          <div className="space-y-3">
            <div className="w-full h-40 rounded-lg overflow-hidden mb-3">
              <img src={selectedDonation.image} alt={selectedDonation.foodName} className="w-full h-full object-cover" />
            </div>
            <DetailRow label="Food Name" value={selectedDonation.foodName} />
            <DetailRow label="Category" value={selectedDonation.category} />
            <DetailRow label="Quantity" value={selectedDonation.quantity} />
            <DetailRow label="Donor" value={selectedDonation.donorName} />
            <DetailRow label="Location" value={selectedDonation.location} />
            <DetailRow label="Status" value={selectedDonation.status} />
            <DetailRow label="Available Until" value={new Date(selectedDonation.availableUntil).toLocaleDateString()} />
            <DetailRow label="Posted" value={new Date(selectedDonation.createdAt).toLocaleDateString()} />
            <div className="pt-2">
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700">{selectedDonation.description}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove Donation"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => confirmDelete && handleRemove(confirmDelete)}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to remove <strong>{confirmDelete?.foodName}</strong>? This action cannot be undone.
        </p>
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
