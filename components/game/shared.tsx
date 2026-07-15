'use client'

import { useState } from 'react'

export const instanceId = (skinId: string) => `${skinId}::${crypto.randomUUID()}`
export const skinIdFromInstance = (id: string) => id.split('::')[0]

export function Mark({ small = false }: { small?: boolean }) {
  return <span className={small ? 'mark mark-small' : 'mark'} aria-hidden="true"><i/><i/></span>
}

export function SkinImage({ src, alt, className = '', priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  return <span className={`skin-image-shell ${loaded ? 'is-loaded' : ''} ${failed ? 'is-failed' : ''} ${className}`}><span className="skin-image-placeholder"><Mark small/></span>{!failed && <img src={src || "/placeholder.svg"} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onLoad={() => setLoaded(true)} onError={() => setFailed(true)}/>} {failed && <span className="skin-image-error">IMAGE UNAVAILABLE</span>}</span>
}

export function CrashGraph({ multiplier, playing }: { multiplier: number; playing: boolean }) {
  const progress = Math.min(1, Math.max(0.025, Math.log(Math.max(1, multiplier)) / Math.log(12)))
  const curveY = (value: number) => 260 - ((Math.exp(value * 2.7) - 1) / (Math.exp(2.7) - 1)) * 220
  const steps = Math.max(2, Math.ceil(progress * 60))
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const xProgress = progress * (index / steps)
    return `${xProgress * 760},${curveY(xProgress)}`
  }).join(' ')
  const markerX = progress * 760
  const markerY = curveY(progress)
  return <div className={`crash-graph ${playing ? 'is-flying' : ''}`}><svg viewBox="0 0 780 290" preserveAspectRatio="none" aria-hidden="true"><g className="crash-grid">{[40, 100, 160, 220, 280].map((y) => <line key={y} x1="0" y1={y} x2="780" y2={y}/>)}{[0, 195, 390, 585, 780].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="290"/>)}</g><polyline className="crash-curve" points={points}/><circle className="crash-marker" cx={markerX} cy={markerY} r="7"/></svg><div className="crash-value"><b>{multiplier.toFixed(2)}X</b><span>{playing ? 'FLYING' : 'READY'}</span></div></div>
}
