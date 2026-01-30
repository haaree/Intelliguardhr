
import React from 'react';

interface LandingPageProps {
  onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-8 h-8 bg-teal-600 rounded-lg"></div>
          <span className="text-2xl font-bold text-slate-900">Intelliguard HR</span>
        </div>
        <nav className="hidden md:flex space-x-8 text-slate-600 font-medium">
          <a href="#features" className="hover:text-teal-600">Features</a>
          <a href="#pricing" className="hover:text-teal-600">Pricing</a>
          <a href="#contact" className="hover:text-teal-600">Contact</a>
        </nav>
        <button 
          onClick={onStart}
          className="bg-teal-600 text-white px-6 py-2 rounded-full font-medium hover:bg-teal-700 transition-colors"
        >
          Login
        </button>
      </header>

      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight">
          Intelligent Attendance <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">
            Secured by AI.
          </span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Bulk upload shifts, track attendance, and get automated reports with deep workforce insights using advanced AI logic.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button 
            onClick={onStart}
            className="bg-teal-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-teal-700 transition-all shadow-lg shadow-teal-200"
          >
            Get Started Free
          </button>
          <button className="bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 transition-all">
            Watch Demo
          </button>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-slate-900">500+</div>
            <div className="text-slate-500">Organizations</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900">2M+</div>
            <div className="text-slate-500">Logs Validated</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900">99.9%</div>
            <div className="text-slate-500">Uptime</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900">24/7</div>
            <div className="text-slate-500">AI Logic</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 mb-6 font-bold text-xl">1</div>
            <h3 className="text-xl font-bold mb-4">Master Registry</h3>
            <p className="text-slate-600 leading-relaxed">
              Seamlessly import your personnel data for employees, daily logs, and complex shift settings.
            </p>
          </div>
          <div className="p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6 font-bold text-xl">2</div>
            <h3 className="text-xl font-bold mb-4">Settings Matrix</h3>
            <p className="text-slate-600 leading-relaxed">
              Automated shift matching with flexible grace periods and regulatory compliance auditing.
            </p>
          </div>
          <div className="p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-fuchsia-100 rounded-xl flex items-center justify-center text-fuchsia-600 mb-6 font-bold text-xl">3</div>
            <h3 className="text-xl font-bold mb-4">AI Inferences</h3>
            <p className="text-slate-600 leading-relaxed">
              Leverage Gemini models to identify absenteeism patterns and department performance trends.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Scalable Pricing</h2>
            <p className="text-slate-400">Management solutions for every workforce size.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-8 rounded-3xl bg-slate-800 border border-slate-700">
              <h4 className="text-slate-400 font-bold mb-2">Startup</h4>
              <div className="text-4xl font-bold mb-6">$0 <span className="text-lg font-normal text-slate-500">/mo</span></div>
              <ul className="space-y-4 mb-8 text-slate-300">
                <li>• Up to 50 employees</li>
                <li>• Standard reports</li>
                <li>• Email support</li>
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-3 rounded-xl border border-slate-600 hover:bg-slate-700 transition-all font-bold"
              >
                Start Free
              </button>
            </div>
            <div className="p-8 rounded-3xl bg-teal-600 border border-teal-500 transform scale-105 shadow-2xl">
              <h4 className="text-teal-200 font-bold mb-2">Pro</h4>
              <div className="text-4xl font-bold mb-6">$99 <span className="text-lg font-normal text-teal-300">/mo</span></div>
              <ul className="space-y-4 mb-8">
                <li>• Unlimited employees</li>
                <li>• AI Insights Engine</li>
                <li>• Advanced Shift Settings</li>
                <li>• Full API Access</li>
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-3 rounded-xl bg-white text-teal-600 font-bold hover:bg-slate-100 transition-all"
              >
                Get Pro
              </button>
            </div>
            <div className="p-8 rounded-3xl bg-slate-800 border border-slate-700">
              <h4 className="text-slate-400 font-bold mb-2">Enterprise</h4>
              <div className="text-4xl font-bold mb-6">Custom</div>
              <ul className="space-y-4 mb-8 text-slate-300">
                <li>• Dedicated Deployment</li>
                <li>• Custom Security Logic</li>
                <li>• 24/7 SLA Support</li>
              </ul>
              <button 
                onClick={onStart}
                className="w-full py-3 rounded-xl border border-slate-600 hover:bg-slate-700 transition-all font-bold"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
