import { Link } from 'react-router-dom';
import { Leaf, Target, Users, TrendingDown, ArrowRight, Heart, Shield, Sprout } from 'lucide-react';
import Footer from '@/components/layout/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 to-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-6">
            <Leaf className="w-4 h-4" /> About FreshTrack
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Bridging the gap between surplus food and hunger</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            FreshTrack is a food donation platform built to reduce food waste and fight hunger by connecting people and organizations with surplus food to nearby NGOs.
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                <TrendingDown className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">The Problem</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Millions of tons of edible food go to waste every year — from restaurants, events, and households — while millions of people face food insecurity. The food exists. The need exists. What's missing is the connection.
              </p>
              <p className="text-gray-600 leading-relaxed">
                FreshTrack was created to close that gap with a simple, practical platform that makes food donation easy and accessible.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <img src="https://images.pexels.com/photos/2654560/pexels-photo-2654560.jpeg?auto=compress&cs=tinysrgb&w=700" alt="Food waste awareness" className="w-full h-80 object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">What We Stand For</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Our core values guide everything we build.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Heart, title: 'Compassion', desc: 'We believe everyone deserves access to good food, and every effort to help matters.', color: 'bg-primary-100 text-primary-600' },
              { icon: Shield, title: 'Trust', desc: 'We connect verified donors with real NGOs to ensure food reaches those who need it.', color: 'bg-blue-100 text-blue-600' },
              { icon: Sprout, title: 'Sustainability', desc: 'Reducing food waste is one of the most effective ways to fight climate change.', color: 'bg-amber-100 text-amber-600' },
            ].map((value, i) => (
              <div key={i} className="card p-6">
                <div className={`w-12 h-12 rounded-xl ${value.color} flex items-center justify-center mb-4`}>
                  <value.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Who */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Who Is FreshTrack For?</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Three roles, one shared mission.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Donors', desc: 'Restaurants, cafeterias, event organizers, or individuals with surplus food.', color: 'bg-primary-100 text-primary-600' },
              { icon: Heart, title: 'NGOs', desc: 'Organizations that collect food and distribute it to people in need.', color: 'bg-amber-100 text-amber-600' },
              { icon: Shield, title: 'Admins', desc: 'Platform managers who ensure donations are appropriate and users are verified.', color: 'bg-blue-100 text-blue-600' },
            ].map((role, i) => (
              <div key={i} className="card p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl ${role.color} flex items-center justify-center mx-auto mb-4`}>
                  <role.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{role.title}</h3>
                <p className="text-sm text-gray-600">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Target className="w-12 h-12 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Join us in making a difference</h2>
          <p className="text-primary-100 mb-8 max-w-xl mx-auto">
            Whether you have food to share or people to feed, FreshTrack makes the connection simple.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-700 font-medium px-6 py-3 rounded-lg hover:bg-primary-50 transition-colors">
            Get Started <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
