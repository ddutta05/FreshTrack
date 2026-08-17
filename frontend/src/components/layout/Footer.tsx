import { Link } from 'react-router-dom';
import { Leaf, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">FreshTrack</span>
            </div>
            <p className="text-sm text-gray-400 max-w-xs">
              Connecting surplus food with NGOs to ensure good food reaches people who need it, not the landfill.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-400 hover:text-primary-400 transition-colors">Home</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-primary-400 transition-colors">About</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-primary-400 transition-colors">Login</Link></li>
              <li><Link to="/register" className="text-gray-400 hover:text-primary-400 transition-colors">Register</Link></li>
            </ul>
          </div>

          {/* Mission */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Our Mission</h4>
            <p className="text-sm text-gray-400">
              Reducing food waste and fighting hunger, one donation at a time. Together we can make a difference.
            </p>
          </div>
        </div>

        
      </div>
    </footer>
  );
}
