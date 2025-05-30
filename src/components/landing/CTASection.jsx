import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";

export const CTASection = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-900 via-blue-600 to-blue-900">
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-white mb-6">
          Ready to transform your invoicing?
        </h2>
        <p className="text-xl text-blue-100 mb-8">
          Join thousands of businesses who've made the switch to effortless quoting and invoicing
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-950 hover:text-white px-8 py-4 text-lg font-semibold group"
            onClick={() => window.location.href = '/signup'}
          >
            Start Getting Paid Faster
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:text-white transition-all" />
          </Button>
          <Button 
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-950 hover:text-white px-8 py-4 text-lg font-semibold group"
            onClick={() => window.location.href = 'https://calendly.com/lv-billienow/30min'}
          >
            Schedule a Demo
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 group-hover:text-white transition-all" />
          </Button>
        </div>

        <p className="text-blue-200 text-sm mt-6">
          Try it for free today • No setup fees • Cancel anytime
        </p>
      </div>
    </section>
  );
}; 