import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import Button from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { donationService } from '@/services/services';
import { FOOD_CATEGORIES } from '@/types';

const SAMPLE_IMAGES = [

  'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=600',
];

export default function CreateDonation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    foodName: '',
    category: '',
    quantity: '',
    description: '',
    availableUntil: '',
    location: '',
    image: SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) return;

    setLoading(true);
    try {
      await donationService.create(
        {
          foodName: form.foodName,
          category: form.category,
          quantity: form.quantity,
          description: form.description,
          image: form.image,
          location: form.location,
          availableUntil: new Date(form.availableUntil).toISOString(),
        },
        user
      );
      toast('Donation posted successfully!', 'success');
      navigate('/my-donations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post donation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Donate Food</h1>
        <p className="text-gray-500 mb-6">Fill in the details below to post your surplus food.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <Input
            label="Food Name"
            placeholder="e.g. Fresh Vegetable Curry"
            value={form.foodName}
            onChange={(e) => handleChange('foodName', e.target.value)}
            required
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Food Category"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              required
            >
              <option value="">Select category</option>
              {FOOD_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
            <Input
              label="Quantity"
              placeholder="e.g. 15 servings, 5 kg"
              value={form.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              required
            />
          </div>

          <Textarea
            label="Description"
            placeholder="Describe the food — what it is, how it was prepared, any allergens, etc."
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            required
          />

          <div className="grid sm:grid-cols-2 gap-4">
            
            <Input
              label="Pickup Location"
              placeholder="e.g. Downtown Community Center, 123 Main St"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Food Image</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <img src={form.image} alt="Food preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-2">Choose a sample image:</p>
                <div className="flex gap-2 flex-wrap">
                  {SAMPLE_IMAGES.map((img) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => handleChange('image', img)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${form.image === img ? 'border-primary-500 ring-2 ring-primary-200' : 'border-transparent hover:border-gray-300'}`}
                    >
                      <img src={img} alt="Sample" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Image upload will be available with the backend.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Posting...' : 'Post Donation'}
            </Button>
            <Link to="/dashboard" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
