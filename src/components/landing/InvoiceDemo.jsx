import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Send } from "lucide-react";

export const InvoiceDemo = () => {
  const [step, setStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setStep((prev) => (prev + 1) % 3);
        setIsAnimating(false);
      }, 500);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const steps = [
    {
      title: "1. Add Client Info",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Client Name</label>
            <Input 
              value="Acme Corporation" 
              readOnly 
              className="animate-fade-in"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input 
              value="billing@acme.com" 
              readOnly 
              className="animate-fade-in delay-100"
            />
          </div>
        </div>
      )
    },
    {
      title: "2. Add Line Items",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-3 animate-fade-in">
            <div className="flex justify-between">
              <span className="font-medium">Website Design</span>
              <span className="font-semibold">$2,500</span>
            </div>
            <div className="flex justify-between animate-fade-in delay-100">
              <span className="font-medium">Development</span>
              <span className="font-semibold">$4,000</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-lg font-bold animate-fade-in delay-200">
              <span>Total</span>
              <span className="text-blue-600">$6,500</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. Send & Get Paid",
      content: (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
            <div className="text-green-800 font-semibold mb-2">Invoice Sent Successfully! ✅</div>
            <div className="text-green-600 text-sm">Payment link included • Auto-reminders enabled</div>
          </div>
          <Button className="w-full bg-blue-950 hover:bg-blue-950 text-white">
            <Send className="w-4 h-4 mr-2" />
            Send Another Invoice
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="relative">
      <Card className={`p-6 shadow-2xl bg-white border-0 transition-all duration-500 ${isAnimating ? 'scale-105 shadow-3xl' : ''}`}>
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {steps[step].title}
          </h3>
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                  i <= step ? 'bg-blue-950' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
        
        <div className="min-h-[200px]">
          {steps[step].content}
        </div>
      </Card>

      {/* Floating elements for visual appeal */}
      <div className="absolute -top-4 -right-4 w-8 h-8 bg-blue-400 rounded-full animate-pulse"></div>
      <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-blue-400 rounded-full animate-pulse delay-500"></div>
    </div>
  );
}; 