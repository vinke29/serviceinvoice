  return (
    <div className="min-h-screen bg-cream-50 flex flex-col lg:flex-row">
      {/* Left side - Content and illustration */}
      <div className="flex-1 px-8 py-12 flex flex-col">
        {/* Logo */}
        <div className="mb-12 pl-8 lg:pl-16">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full"></div>
            <span className="ml-3 text-3xl font-bold text-blue-900">Billie</span>
          </div>
        </div>
        
        {/* Main content */}
        <div className={`max-w-xl pl-8 lg:pl-16 ${animation}`}> 
          <h1 className="text-5xl font-bold text-blue-900 mb-6">
            Billie helps you<br />get paid. Faster.
          </h1>
          
          <p className="text-xl text-blue-800 mb-8">
            Your AI-powered assistant for invoices, reminders, and payment tracking.
          </p>
          
          {/* Illustration */}
          <div className="mt-4 mb-12">
            <img 
              src="/images/invoice-illustration.png" 
              alt="Invoice assistant illustration" 
              className="w-full max-w-md h-auto object-contain"
            />
          </div>
          
          {/* Footer text */}
          <div className="mt-auto">
            <p className="text-lg text-blue-900">
              Billie keeps your business running smooth—so you don't have to chase checks.
            </p>
          </div>
        </div>
      </div>
    </div>
  ); 