import { useEffect, useRef } from 'react'

export function CreateQuoteDemo() {
  const arcadeIframeRef = useRef(null);

  useEffect(() => {
    function onArcadeIframeMessage(e) {
      if (e.origin !== 'https://demo.arcade.software' || !e.isTrusted) return;

      const arcadeIframe = arcadeIframeRef.current;
      if (!arcadeIframe || !arcadeIframe.contentWindow) return;

      if (e.data.event === 'arcade-init') {
        arcadeIframe.contentWindow.postMessage({event: 'register-popout-handler'}, '*');
      }
      
      if (e.data.event === 'arcade-popout-open') {
        arcadeIframe.style['position'] = 'fixed';
        arcadeIframe.style['z-index'] = '9999999';
      }

      if (e.data.event === 'arcade-popout-close') {
        arcadeIframe.style['position'] = 'absolute';
        arcadeIframe.style['z-index'] = 'auto';
      }
    }

    window.addEventListener('message', onArcadeIframeMessage);

    const arcadeIframe = arcadeIframeRef.current;
    if (arcadeIframe && arcadeIframe.contentWindow) {
      arcadeIframe.contentWindow.postMessage({event: 'register-popout-handler'}, '*');
    }
    
    return () => {
      if (arcadeIframe && arcadeIframe.contentWindow) {
        arcadeIframe.contentWindow.postMessage({event: 'unregister-popout-handler'}, '*');
      }

      window.removeEventListener('message', onArcadeIframeMessage);
    }
  }, [])

  return (
    <div style={{ position: 'relative', paddingBottom: 'calc(53.63204344874406% + 6px)', height: 0, width: '100%' }}>
      <iframe
        ref={arcadeIframeRef}
        src="https://demo.arcade.software/dV6r1qSthRNXtVIkvyQU?embed&embed_mobile=modal&embed_desktop=inline&show_copy_link=true"
        title="BillieNow - invoice creation"
        frameBorder="0"
        loading="lazy"
        allowFullScreen
        allow="clipboard-write"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', colorScheme: 'light' }}
      />
    </div>
  )
}
