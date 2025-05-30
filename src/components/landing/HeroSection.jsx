import { Button } from "../ui/button";
import { ArrowRight, Check } from "lucide-react";
import { InvoiceDemo } from "./InvoiceDemo";
import { useNavigate } from "react-router-dom";

export const HeroSection = ({ scrollY }) => {
  const navigate = useNavigate();
  const parallaxOffset = scrollY * 0.5;

  const scrollToPainPoints = () => {
    const demosSection = document.querySelector('#demos');
    if (demosSection) {
      demosSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Content */}
          <div 
            className="space-y-8 animate-fade-in"
            style={{ transform: `translateY(${parallaxOffset}px)` }}
          >
            <div className="space-y-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                ✨ Making invoicing as easy as 1, 2, 3
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Quotes and Invoices
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500">
                  {" "}in seconds
                </span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Stop the endless back-and-forths. End manual invoicing. Get paid faster. 
                BillieNow makes professional quoting and invoicing as simple as a few clicks.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-lg text-gray-700">Create professional quotes in under 60 seconds</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-lg text-gray-700">Send quotes and invoices that get paid 2x faster</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-lg text-gray-700">Automated follow-ups and payment reminders</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold group"
                size="lg"
                onClick={() => navigate('/signup')}
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>

              <Button 
                variant="outline"
                className="border-2 border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold w-full sm:w-auto"
                size="lg"
                onClick={scrollToPainPoints}
              >
                See How It Works
              </Button>
            </div>
          </div>

          {/* Right side - Demo */}
          <div 
            className="relative"
            style={{ transform: `translateY(${-parallaxOffset}px)` }}
          >
            <InvoiceDemo />
          </div>
        </div>
      </div>

      {/* Background elements */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse z-0"></div>
      <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse delay-1000 z-0"></div>
    </section>
  );
}; 