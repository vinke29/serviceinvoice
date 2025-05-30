import lightningIcon from "../../assets/icons/landing-page/lightning-bolt-icon.svg";
import analyticsIcon from "../../assets/icons/landing-page/data-analytics-icon.svg";
import automationIcon from "../../assets/icons/landing-page/smart-automation-icon.svg";
import mobileIcon from "../../assets/icons/landing-page/mobile-optimized-icon.svg";
import paymentIcon from "../../assets/icons/landing-page/payments-icon.svg";
import templateIcon from "../../assets/icons/landing-page/professional-templates-icon.svg";

export const FeaturesSection = ({ scrollY }) => {
  const features = [
    {
      title: "Lightning Fast Setup",
      description: "Get started in under 5 minutes. No complex configuration or lengthy onboarding.",
      icon: lightningIcon,
      iconAlt: "Lightning bolt icon"
    },
    {
      title: "Professional Templates",
      description: "Beautiful, pre-built templates that make your business look professional.",
      icon: templateIcon,
      iconAlt: "Templates icon"
    },
    {
      title: "Payment Integration", 
      description: "Accept payments instantly with built-in Stripe, PayPal, and bank transfer options.",
      icon: paymentIcon,
      iconAlt: "Payment icon"
    },
    {
      title: "Mobile Optimized",
      description: "Create and send invoices from anywhere, on any device. Your office is wherever you are.",
      icon: mobileIcon,
      iconAlt: "Mobile icon"
    },
    {
      title: "Smart Automation",
      description: "Recurring invoices, payment reminders, and follow-ups that happen automatically.",
      icon: automationIcon,
      iconAlt: "Automation icon"
    },
    {
      title: "Real-time Analytics",
      description: "Track your cash flow, payment patterns, and business growth with detailed insights.",
      icon: analyticsIcon,
      iconAlt: "Analytics icon"
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to get paid faster
          </h2>
          <p className="text-xl text-gray-600">
            Powerful features that work together seamlessly
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={feature.icon} 
                  alt={feature.iconAlt}
                  className="w-6 h-6 text-blue-950 fill-current"
                />
                <h3 className="text-xl font-semibold text-gray-900">
                  {feature.title}
                </h3>
              </div>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}; 