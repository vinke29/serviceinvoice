import React, { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

/**
 * A modal that displays a URL for sharing with easy copy functionality
 */
const ShareLinkModal = ({ isOpen, onClose, url }) => {
  if (!isOpen) return null;
  
  // Focus and select the input when the modal opens
  const inputRef = useRef(null);
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
        inputRef.current.select();
      }, 100);
    }
  }, [isOpen]);
  
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-lg p-5 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3">Share Invoice Link</h3>
        <p className="text-sm text-secondary-600 mb-4">
          Tap and hold the link below to select it, then copy to your clipboard:
        </p>
        
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={url || ''}
            readOnly
            className="w-full px-4 py-3 border border-primary-300 bg-primary-50 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            onClick={e => {
              e.target.select();
              // Try to copy automatically on click
              try {
                navigator.clipboard.writeText(url);
                toast.success('Link copied!');
              } catch (err) {
                // Silent fail - user can still copy manually
              }
            }}
          />
          <div className="mt-3 flex justify-between">
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(url);
                  toast.success('Link copied!');
                } catch (err) {
                  toast.error('Please select and copy manually');
                }
              }}
              className="px-3 py-2 bg-primary-600 text-white rounded-md text-sm"
            >
              Try Copy
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-secondary-200 text-secondary-800 rounded-md text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareLinkModal; 