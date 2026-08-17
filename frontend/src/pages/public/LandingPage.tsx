import { Link } from 'react-router-dom';
import { Leaf, Heart, Package, MapPin, Clock, ArrowRight, ShoppingBag, HandHeart, Truck } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import { impactStats } from '@/data/mockData';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-primary-50/30 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-primary-300 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-primary-200 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-6">
                <Leaf className="w-4 h-4" />
                Reducing food waste, together
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Good Food Should{' '}
                <span className="text-primary-600">Never Go to Waste.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
                FreshTrack connects surplus food from restaurants, events, and individuals with nearby NGOs that can collect and distribute it to people in need.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/login?role=donor" className="btn-primary text-base px-6 py-3">
  <Heart className="w-5 h-5" /> Donate Food
</Link>

<Link to="/login?role=ngo" className="btn-secondary text-base px-6 py-3">
  <ShoppingBag className="w-5 h-5" /> Find Food
</Link>
              </div>
            </div>

            <div className="relative animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden shadow-lg h-56">
                    <img src="https://images.pexels.com/photos/315755/pexels-photo-315755.jpeg?auto=compress&cs=tinysrgb&w=500" alt="Fresh food" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-lg h-32">
                    <img src="https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=500" alt="Community" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="rounded-2xl overflow-hidden shadow-lg h-32">
                    <img src="https://images.pexels.com/photos/2611817/pexels-photo-2611817.jpeg?auto=compress&cs=tinysrgb&w=500" alt="Vegetables" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-lg h-56">
                    <img src="https://images.pexels.com/photos/4198015/pexels-photo-4198015.jpeg?auto=compress&cs=tinysrgb&w=500" alt="Food donation" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-[200px]">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <HandHeart className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">15,200+ meals</p>
                  <p className="text-xs text-gray-500">redistributed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Three simple steps to get surplus food to those who need it most.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Package, title: 'Post Surplus Food', desc: 'Donors list available food with quantity, location, and pickup time.', color: 'bg-primary-100 text-primary-600' },
              { icon: ShoppingBag, title: 'NGO Requests It', desc: 'NGOs browse available donations and request what they can distribute.', color: 'bg-amber-100 text-amber-600' },
              { icon: Truck, title: 'Food Gets Distributed', desc: 'The donor accepts a request, the NGO collects, and food reaches people in need.', color: 'bg-blue-100 text-blue-600' },
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 border-t-2 border-dashed border-gray-200 -translate-x-1/2" />
                )}
                <div className={`w-24 h-24 rounded-2xl ${step.color} flex items-center justify-center mx-auto mb-5 relative`}>
                  <step.icon className="w-10 h-10" />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Our Impact</h2>
            <p className="text-primary-100 max-w-xl mx-auto">Every donation makes a real difference in the fight against food waste and hunger.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { value: impactStats.donations.toLocaleString(), label: 'Food Donations', icon: Package },
              { value: impactStats.ngos, label: 'NGOs Connected', icon: Heart },
              { value: impactStats.meals.toLocaleString(), label: 'Meals Redistributed', icon: HandHeart },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <p className="text-4xl font-bold text-white mb-1">{stat.value}+</p>
                <p className="text-primary-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to make a difference?</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Join FreshTrack today. Whether you have surplus food to donate or an organization that needs food, we'll connect you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-primary text-base px-6 py-3">
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/about" className="btn-secondary text-base px-6 py-3">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
