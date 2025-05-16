import React from 'react'

// Mascot component that appears in all illustrations
export const Billie = ({ pose = 'normal', size = 80, className = "" }) => {
  const poses = {
    normal: (
      <g>
        <circle cx="40" cy="40" r="35" fill="#4CAF50" fillOpacity="0.2" />
        <circle cx="40" cy="30" r="18" fill="#E6F7FF" />
        <circle cx="33" cy="26" r="4" fill="#4CAF50" />
        <circle cx="47" cy="26" r="4" fill="#4CAF50" />
        <path d="M32 36C36 40 44 40 48 36" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M25 17C15 7 5 27 15 37" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 17C65 7 75 27 65 37" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 52C30 52 32 60 40 60C48 60 50 52 50 52" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
    wave: (
      <g>
        <circle cx="40" cy="40" r="35" fill="#4CAF50" fillOpacity="0.2" />
        <circle cx="40" cy="30" r="18" fill="#E6F7FF" />
        <circle cx="33" cy="26" r="4" fill="#4CAF50" />
        <circle cx="47" cy="26" r="4" fill="#4CAF50" />
        <path d="M32 36C36 40 44 40 48 36" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M15 10C12 0 5 20 15 30" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M65 10C75 0 80 15 68 25" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 15L75 5M70 20L78 15M68 25L75 25" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 52C30 52 32 60 40 60C48 60 50 52 50 52" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
    thinking: (
      <g>
        <circle cx="40" cy="40" r="35" fill="#4CAF50" fillOpacity="0.2" />
        <circle cx="40" cy="30" r="18" fill="#E6F7FF" />
        <circle cx="33" cy="26" r="4" fill="#4CAF50" />
        <circle cx="47" cy="26" r="4" fill="#4CAF50" />
        <path d="M32 36C34 38 38 38 40 36" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M25 17C15 7 5 27 15 37" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M55 17C65 7 75 27 65 37" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 15C65 10 70 15 65 20" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 20C70 20 70 25 65 25" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <circle cx="65" cy="30" r="2" fill="#4CAF50" />
      </g>
    ),
    celebrate: (
      <g>
        <circle cx="40" cy="40" r="35" fill="#4CAF50" fillOpacity="0.2" />
        <circle cx="40" cy="30" r="18" fill="#E6F7FF" />
        <circle cx="33" cy="26" r="4" fill="#4CAF50" />
        <circle cx="47" cy="26" r="4" fill="#4CAF50" />
        <path d="M32 34C36 40 44 40 48 34" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 20C5 5 15 0 20 15" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 20C75 5 65 0 60 15" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" />
        <path d="M15 12L10 5M20 15L25 10" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 12L70 5M60 15L55 10" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
      </g>
    )
  };

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className}>
      {poses[pose] || poses.normal}
    </svg>
  );
};

export const WelcomeIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg width="260" height="260" viewBox="0 0 260 260">
      {/* Background elements */}
      <circle cx="130" cy="130" r="120" fill="#E9F5FF"/>
      <circle cx="130" cy="130" r="90" fill="#CCE9FF"/>
      <path d="M130 210C173.63 210 209 174.63 209 131C209 87.3695 173.63 52 130 52C86.3695 52 51 87.3695 51 131C51 174.63 86.3695 210 130 210Z" fill="#4CAF50" fillOpacity="0.1"/>
      
      {/* Confetti elements */}
      <rect x="50" y="50" width="10" height="10" rx="2" fill="#4CAF50" fillOpacity="0.6" transform="rotate(15 50 50)"/>
      <rect x="200" y="70" width="14" height="14" rx="2" fill="#4CAF50" fillOpacity="0.6" transform="rotate(45 200 70)"/>
      <rect x="60" y="190" width="12" height="12" rx="2" fill="#4CAF50" fillOpacity="0.4" transform="rotate(-30 60 190)"/>
      <rect x="180" y="200" width="8" height="8" rx="2" fill="#4CAF50" fillOpacity="0.5" transform="rotate(60 180 200)"/>
      
      {/* Welcome text */}
      <path d="M90 150L110 170L150 130" stroke="#4CAF50" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Billie mascot */}
      <g transform="translate(130, 80)">
        <Billie pose="wave" size={100} />
      </g>
    </svg>
  </div>
)

export const AIAgentIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg width="260" height="260" viewBox="0 0 260 260">
      {/* Background */}
      <rect x="40" y="60" width="180" height="140" rx="16" fill="#E6F7FF"/>
      
      {/* Robot elements */}
      <rect x="70" y="80" width="120" height="90" rx="8" fill="#4CAF50" fillOpacity="0.2"/>
      <circle cx="100" cy="110" r="10" fill="#4CAF50" fillOpacity="0.6"/>
      <circle cx="160" cy="110" r="10" fill="#4CAF50" fillOpacity="0.6"/>
      <path d="M110 130H150" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round"/>
      <path d="M90 160C100 170 140 170 150 160" stroke="#4CAF50" strokeWidth="4" strokeLinecap="round"/>
      
      {/* Automation symbols */}
      <circle cx="210" cy="60" r="15" fill="#4CAF50" fillOpacity="0.3"/>
      <path d="M204 60L210 54L216 60" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M210 54V66" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      
      <circle cx="50" cy="190" r="15" fill="#4CAF50" fillOpacity="0.3"/>
      <path d="M44 190L50 196L56 190" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M50 196V184" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Billie mascot */}
      <g transform="translate(200, 180)">
        <Billie pose="thinking" size={80} />
      </g>
    </svg>
  </div>
)

export const ClientsIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg width="260" height="260" viewBox="0 0 260 260">
      {/* Background */}
      <rect x="50" y="50" width="160" height="160" rx="10" fill="#F0F7FF"/>
      
      {/* Client card */}
      <rect x="70" y="80" width="120" height="80" rx="8" fill="white" stroke="#4CAF50" strokeWidth="2"/>
      <circle cx="100" cy="100" r="15" fill="#4CAF50" fillOpacity="0.2"/>
      <path d="M94 100H106" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M100 94V106" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M120 95H170" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M120 110H150" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Client icons */}
      <circle cx="100" cy="180" r="20" fill="#E6F7FF"/>
      <circle cx="160" cy="180" r="20" fill="#E6F7FF"/>
      <path d="M95 180H105" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M100 175V185" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      <path d="M155 180H165" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Billie mascot */}
      <g transform="translate(200, 70)">
        <Billie pose="normal" size={80} />
      </g>
    </svg>
  </div>
)

export const InvoiceIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg width="260" height="260" viewBox="0 0 260 260">
      {/* Background */}
      <rect x="40" y="40" width="140" height="180" rx="8" fill="#E6F7FF"/>
      
      {/* Invoice elements */}
      <rect x="60" y="60" width="100" height="140" rx="4" fill="white" stroke="#4CAF50" strokeWidth="2"/>
      <rect x="70" y="80" width="80" height="8" rx="4" fill="#4CAF50" fillOpacity="0.4"/>
      <rect x="70" y="100" width="60" height="8" rx="4" fill="#4CAF50" fillOpacity="0.4"/>
      <rect x="70" y="120" width="80" height="8" rx="4" fill="#4CAF50" fillOpacity="0.4"/>
      <rect x="70" y="140" width="40" height="8" rx="4" fill="#4CAF50" fillOpacity="0.4"/>
      
      {/* Money symbols */}
      <circle cx="200" cy="80" r="25" fill="#4CAF50" fillOpacity="0.2"/>
      <path d="M200 70V90" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      <path d="M195 75H205" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      <path d="M195 85H205" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      
      <circle cx="200" cy="140" r="20" fill="#4CAF50" fillOpacity="0.2"/>
      <path d="M200 132V148" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      <path d="M196 136H204" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      <path d="M196 144H204" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round"/>
      
      {/* Billie mascot */}
      <g transform="translate(200, 200)">
        <Billie pose="normal" size={80} />
      </g>
    </svg>
  </div>
)

export const GetPaidIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg width="260" height="260" viewBox="0 0 260 260">
      {/* Background */}
      <circle cx="130" cy="130" r="100" fill="#4CAF50" fillOpacity="0.1"/>
      <circle cx="130" cy="130" r="70" fill="#E6F7FF"/>
      
      {/* Money symbols */}
      <circle cx="130" cy="110" r="40" fill="#4CAF50" fillOpacity="0.3"/>
      <path d="M130 90V130" stroke="white" strokeWidth="6" strokeLinecap="round"/>
      <path d="M115 105H145" stroke="white" strokeWidth="6" strokeLinecap="round"/>
      
      {/* Success elements */}
      <path d="M90 170L110 190L160 140" stroke="#4CAF50" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Confetti */}
      <rect x="50" y="70" width="12" height="12" rx="2" fill="#4CAF50" fillOpacity="0.6" transform="rotate(15 50 70)"/>
      <rect x="200" y="60" width="15" height="15" rx="2" fill="#4CAF50" fillOpacity="0.6" transform="rotate(45 200 60)"/>
      <rect x="40" y="180" width="10" height="10" rx="2" fill="#4CAF50" fillOpacity="0.4" transform="rotate(-30 40 180)"/>
      <rect x="210" y="180" width="14" height="14" rx="2" fill="#4CAF50" fillOpacity="0.5" transform="rotate(60 210 180)"/>
      
      {/* Billie mascot */}
      <g transform="translate(200, 120)">
        <Billie pose="celebrate" size={80} />
      </g>
    </svg>
  </div>
)

function OnboardingIllustrations({ type }) {
  switch (type) {
    case 'welcome':
      return <WelcomeIllustration />
    case 'ai-agent':
      return <AIAgentIllustration />
    case 'first-client':
      return <ClientsIllustration />
    case 'create-invoice':
      return <InvoiceIllustration />
    case 'get-paid':
      return <GetPaidIllustration />
    default:
      return <WelcomeIllustration />
  }
}

export default OnboardingIllustrations 