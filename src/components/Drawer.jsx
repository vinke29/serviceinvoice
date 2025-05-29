import { useEffect } from 'react'

function Drawer({ isOpen, onClose, title, children, maxWidth }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 right-0 h-full w-full ${maxWidth || 'max-w-[28rem]'} bg-white shadow-xl flex flex-col z-[101]`}
      >
        <div className="px-6 py-4 border-b border-secondary-200 flex items-center justify-between bg-white">
          <h3 className="text-xl font-semibold text-secondary-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-secondary-500 hover:text-secondary-700 rounded-lg hover:bg-secondary-50 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Drawer 