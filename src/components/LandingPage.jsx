import React, { useState, useEffect } from 'react';
import { Navigation } from './landing/Navigation';
import { HeroSection } from './landing/HeroSection';
import { PainPointsSection } from './landing/PainPointsSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { CTASection } from './landing/CTASection';

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <HeroSection scrollY={scrollY} />
      <PainPointsSection scrollY={scrollY} />
      <FeaturesSection scrollY={scrollY} />
      <CTASection />
    </div>
  );
} 