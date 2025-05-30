import { useEffect, useRef } from 'react'

export function ArcadeEmbed() {
  return (
    <div style={{ position: 'relative', paddingBottom: 'calc(53.63204344874406% + 41px)', height: 0, width: '100%' }}>
      <iframe
        src="https://demo.arcade.software/dV6r1qSthRNXtVIkvyQU?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
        title="BillieNow Invoice Creation"
        frameBorder="0"
        loading="lazy"
        allowFullScreen
        allow="clipboard-write"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', colorScheme: 'light' }}
      />
    </div>
  )
}
