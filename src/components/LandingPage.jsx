import React from 'react';
import { useNavigate } from 'react-router-dom';

// Minimal Landing Navbar
function LandingNavbar() {
  const navigate = useNavigate();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
        {/* Logo */}
        <span 
          className="text-xl font-bold text-primary hover:text-primary/90 transition-colors cursor-pointer" 
          onClick={() => navigate('/')}
        >
          BillieNow
        </span>

        {/* Navigation Links */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/signin')}
            className="text-gray-600 hover:text-gray-900 font-medium py-2 px-4 rounded transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-primary text-white shadow-sm hover:bg-primary-700 transition"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}

// Simple Container
function Container({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

// Simple Typography
function H1({ children, className = '' }) {
  return <h1 className={`text-4xl sm:text-5xl font-extrabold tracking-tight lg:text-6xl ${className}`}>{children}</h1>;
}

function H2({ children, className = '' }) {
  return <h2 className={`text-3xl font-semibold tracking-tight ${className}`}>{children}</h2>;
}

function P({ children, className = '' }) {
  return <p className={`leading-7 mt-2 ${className}`}>{children}</p>;
}

// Simple Button
function Button({ children, onClick, className = '', ...props }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md text-lg font-medium px-6 py-3 transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Hero Section
function Hero() {
  const navigate = useNavigate();
  
  return (
    <section className="pt-32 pb-16 overflow-hidden bg-gradient-to-b from-blue-100 to-blue-50">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 text-center lg:text-left">
            <H1 className="mb-6 text-blue-900">
              Tired of chasing payments? <br />
              <span className="text-primary">
                Then don't. Billie does it for you.
              </span>
            </H1>
            <P className="text-xl text-blue-700 mb-8">
              Billie sends the invoice, and makes sure you get paid - on time, every time.
            </P>
            <div className="flex flex-col sm:flex-row gap-4 lg:justify-start justify-center">
              <Button 
                onClick={() => navigate('/signup')} 
                className="bg-primary hover:bg-primary-700 text-white shadow-md group"
              >
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Button>
              <Button 
                onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}
                className="border-2 border-primary text-primary hover:bg-primary-50 shadow-sm"
              >
                View Demo
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto max-w-md">
              <div className="relative aspect-square h-[400px]">
                <img
                  src="/images/illustrations/billie-hero.png"
                  alt="Meet Billie - Your Billing Assistant"
                  className="object-contain w-full h-full"
                />
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/50 via-primary/20 to-transparent rounded-full blur-3xl -z-10" />
              <div className="absolute -inset-4 bg-gradient-to-bl from-primary/40 via-primary/10 to-transparent rounded-full blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// Painpoints Section
function Painpoints() {
  const painPoints = [
    {
      title: "Confused by Complex Billing?",
      description: "Stop struggling with complicated systems and manual invoice processing. Our intuitive platform makes billing simple.",
      image: "/images/illustrations/billie-confused-transparent.png"
    },
    {
      title: "Too Many Payment Methods?",
      description: "Managing different payment platforms shouldn't be a hassle. We keep track of all invoices in one place.",
      image: "/images/illustrations/billie-payments-transparent.png"
    },
    {
      title: "Chasing Late Payments?",
      description: "No more running after customers for overdue payments. Automated reminders and follow-ups keep your cash flowing.",
      image: "/images/illustrations/billie-running-transparent.png"
    }
  ];
  
  return (
    <section className="py-24 bg-blue-50">
      <Container>
        <div className="text-center mb-16">
          <H2 className="mb-4 text-blue-900">Common Billing Challenges</H2>
          <P className="text-xl text-blue-700 max-w-3xl mx-auto">
            We understand the frustrations that come with managing business payments. Here's how Billie helps you overcome them.
          </P>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {painPoints.map((point) => (
            <div key={point.title} className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="relative h-48 mb-6">
                <img
                  src={point.image}
                  alt={point.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">{point.title}</h3>
              <p className="text-blue-700">{point.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// Demo Section
function Demo() {
  return (
    <section id="demo-section" className="py-24 bg-white">
      <Container>
        <div className="text-center mb-16">
          <H2 className="mb-4 text-blue-900">See BillieNow in Action</H2>
          <P className="text-xl text-blue-700 max-w-3xl mx-auto">
            Watch how BillieNow transforms your billing workflow from chaos to clarity.
          </P>
        </div>
        <div className="relative mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-blue-200 shadow-2xl">
            <div style={{ position: 'relative', paddingBottom: '53.6%', height: 0, width: '100%' }}>
              <iframe
                src="https://demo.arcade.software/CgtmSuh05XxpdK10hFJG?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
                title="BillieNow Demo"
                frameBorder="0"
                loading="lazy"
                allowFullScreen
                allow="clipboard-write"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', colorScheme: 'light' }}
              />
            </div>
          </div>
          <div className="absolute -inset-x-8 -bottom-16 -z-10">
            <div className="h-32 bg-gradient-to-b from-blue-50/50 to-transparent" />
          </div>
        </div>
      </Container>
    </section>
  );
}

// Features Section
function Features() {
  const features = [
    {
      title: "Automated Billing",
      description: "Set up your billing rules once and let our system handle the rest. No more manual invoice creation or tracking.",
      icon: (
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )
    },
    {
      title: "Revenue Analytics",
      description: "Get real-time insights into your revenue streams, payment patterns, and financial forecasts.",
      icon: (
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/><rect x="7" y="13" width="3" height="5" rx="1"/><rect x="14" y="8" width="3" height="10" rx="1"/></svg>
      )
    },
    {
      title: "Smart Collections",
      description: "Automated payment reminders and follow-ups that maintain professional relationships while ensuring timely payments.",
      icon: (
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )
    },
    {
      title: "Secure Payments",
      description: "Enterprise-grade security for all your payment processing, with full compliance and audit trails.",
      icon: (
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      ),
      comingSoon: true
    }
  ];
  
  return (
    <section className="py-24 bg-blue-50">
      <Container>
        <div className="text-center mb-16">
          <H2 className="mb-4 text-blue-900">Everything you need to streamline billing</H2>
          <P className="text-xl text-blue-700 max-w-3xl mx-auto">
            Powerful features that help you take control of your billing process and focus on growing your business.
          </P>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="relative p-8 rounded-2xl bg-white border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-1 text-blue-900">{feature.title}</h3>
              {feature.comingSoon && (
                <div className="text-sm font-bold text-blue-600 mb-3">Coming soon</div>
              )}
              <p className="text-blue-700">{feature.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// CTA Section
function CallToAction() {
  const navigate = useNavigate();
  
  return (
    <section className="py-24 bg-gradient-to-br from-primary to-primary-800">
      <Container>
        <div className="text-center">
          <H2 className="text-white mb-6">
            Ready to transform your billing process?
          </H2>
          <P className="text-white text-xl max-w-2xl mx-auto mb-8">
            Join hundreds of businesses that have simplified their billing and improved their cash flow with BillieNow.
          </P>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/signup')}
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
            >
              Get Paid Faster
            </Button>
            <Button
              onClick={() => document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' })}
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 shadow-md"
            >
              Learn More
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <main>
        <Hero />
        <Painpoints />
        <Demo />
        <Features />
        <CallToAction />
      </main>
    </div>
  );
} 