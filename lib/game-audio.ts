type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }

let context: AudioContext | null = null
let spinTimer: ReturnType<typeof setTimeout> | null = null
const GAME_VOLUME_MULTIPLIER = 3

function audioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext
  if (!AudioContextClass) return null
  context ??= new AudioContextClass()
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(frequency: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
  const ctx = audioContext()
  if (!ctx) return
  const start = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.82), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.min(1, volume * GAME_VOLUME_MULTIPLIER), start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playUpgradeClick(enabled: boolean) {
  if (!enabled) return
  tone(420, 0.055, 0.045, 'sine')
  tone(170, 0.075, 0.032, 'triangle', 0.018)
}

export function startSpinSound(enabled: boolean, duration = 1900) {
  if (!enabled) return
  stopSpinSound()
  const started = performance.now()
  const tick = () => {
    const progress = Math.min(1, (performance.now() - started) / duration)
    tone(245 - progress * 70, 0.035, 0.018 + (1 - progress) * 0.012, 'triangle')
    if (progress < 1) spinTimer = setTimeout(tick, 48 + progress * 145)
  }
  tick()
}

export function stopSpinSound() {
  if (spinTimer) clearTimeout(spinTimer)
  spinTimer = null
}

export function playArcadeStart(enabled: boolean, game: 'crash' | 'mines' | 'cases' | 'roulette' | 'tower' | 'plinko', duration = 1600) {
  if (!enabled) return
  if (game === 'roulette') { startSpinSound(true, duration); return }
  if (game === 'crash') { tone(210, 0.12, 0.028, 'sawtooth'); tone(310, 0.16, 0.022, 'triangle', 0.06); return }
  if (game === 'cases') { startSpinSound(true, duration); return }
  tone(game === 'mines' ? 360 : 290, 0.08, 0.03, 'triangle')
  tone(game === 'mines' ? 470 : 390, 0.1, 0.024, 'sine', 0.05)
}

export function playArcadeStep(enabled: boolean, safe: boolean) {
  if (!enabled) return
  tone(safe ? 540 : 125, safe ? 0.1 : 0.24, safe ? 0.026 : 0.04, safe ? 'sine' : 'sawtooth')
  if (safe) tone(680, 0.13, 0.02, 'sine', 0.05)
}

export function playUpgradeResult(enabled: boolean, won: boolean) {
  if (!enabled) return
  stopSpinSound()
  if (won) {
    tone(392, 0.16, 0.035, 'sine')
    tone(523, 0.2, 0.032, 'sine', 0.09)
    tone(659, 0.28, 0.028, 'sine', 0.18)
  } else {
    tone(196, 0.17, 0.028, 'triangle')
    tone(146, 0.24, 0.024, 'sine', 0.09)
  }
}
