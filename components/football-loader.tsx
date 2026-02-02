'use client'

export function FootballLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className="flex items-center justify-center text-primary">
      <svg
        className={`${sizeClasses[size]} animate-bounce-spin`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ball base */}
        <circle cx="50" cy="50" r="47" fill="white" stroke="currentColor" strokeWidth="3" />
        
        {/* Center pentagon */}
        <path
          d="M50 25 L62 40 L57 55 L43 55 L38 40 Z"
          fill="currentColor"
        />
        
        {/* Top pentagon */}
        <path
          d="M50 8 L58 16 L54 24 L46 24 L42 16 Z"
          fill="currentColor"
        />
        
        {/* Right pentagon */}
        <path
          d="M76 35 L80 45 L72 52 L64 46 L68 36 Z"
          fill="currentColor"
        />
        
        {/* Bottom right pentagon */}
        <path
          d="M68 68 L72 78 L64 85 L54 80 L58 70 Z"
          fill="currentColor"
        />
        
        {/* Bottom left pentagon */}
        <path
          d="M32 68 L42 70 L46 80 L36 85 L28 78 Z"
          fill="currentColor"
        />
        
        {/* Left pentagon */}
        <path
          d="M24 35 L32 36 L36 46 L28 52 L20 45 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  )
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
      <FootballLoader size="lg" />
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
      )}
    </div>
  )
}
