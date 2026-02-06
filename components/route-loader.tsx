'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useActionLoader } from '@/components/football-loader'

/**
 * Shows the global full-screen loader on route transitions.
 *
 * Note:
 * Next.js App Router doesn't expose a native routeChangeStart/Complete event.
 * This component approximates it by:
 *  - showing a loader on click of internal links (capturing phase)
 *  - hiding it when pathname/searchParams change (navigation completed)
 */
export function RouteLoader(): React.JSX.Element {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showLoader, hideLoader } = useActionLoader()

  // Hide loader when navigation completes
  useEffect(() => {
    hideLoader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Show loader on internal navigation clicks
  useEffect(() => {
    function onClickCapture(ev: MouseEvent): void {
      const target = ev.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Ignore new tab / modified clicks
      if (ev.defaultPrevented) return
      if (ev.button !== 0) return
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return

      // Ignore external links
      if (/^https?:\/\//i.test(href)) return
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (href.startsWith('#')) return

      // Ignore Next prefetch-only clicks / download links
      if (anchor.hasAttribute('download')) return
      if (anchor.getAttribute('target') === '_blank') return

      showLoader()
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [showLoader])

  return <></>
}
