import { useEffect, useState, useRef } from "react";
import { CreateQuoteDemo } from "./Arcade-CreateQuoteDemo";
import { DashboardDemo } from "./Arcade-DashboardDemo";
import { AutoEmailsDemo } from "./Arcade-AutoEmailsDemo";

export const PainPointsSection = ({ scrollY }) => {
  const sectionRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const painPoints = [
    {
      problem: "Manual and time-intensive process",
      solution: "Create or edit a quote in less than a minute directly from your phone",
      description: "Automated quote and invoice generation, real-time editing, smart templates.",
      visual: <CreateQuoteDemo />
    },
    {
      problem: "Can't remember who has paid or not",
      solution: "From a spreadsheet or pen and paper, to running on autopilot",
      description: "Centralized client database, payment tracker built-in, smart forecasting dashboard.",
      visual: <DashboardDemo />
    },
    {
      problem: "Tedious payment chasing and follow-ups",
      solution: "Set it, forget it, and watch the payments roll in",
      description: "Intelligent payment reminders, automated follow-ups, and built-in escalation flow.",
      visual: <AutoEmailsDemo />
    }
  ];

  return (
    <section className="py-20 bg-gray-50" id="demos">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            The problems that keep you up at night - <br />
            winning new clients and getting paid
          </h2>
          <p className="text-xl text-gray-600">
            We've solved them, so now you can sleep better
          </p>
        </div>

        <div className="space-y-32">
          {painPoints.map((point, index) => (
            <div
              key={index}
              ref={el => sectionRefs.current[index] = el}
              className="pain-point-section grid lg:grid-cols-2 gap-12 items-center opacity-0"
            >
              <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className="space-y-4">
                  <div className="text-lg text-red-600 font-medium line-through opacity-75">
                    {point.problem}
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {point.solution}
                  </h3>
                  <p className="text-lg text-gray-600">
                    {point.description}
                  </p>
                </div>
              </div>

              <div className={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
                  {point.visual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}; 