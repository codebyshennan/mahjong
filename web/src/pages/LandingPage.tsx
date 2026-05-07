import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TileFace } from '../solo/Tile'
import { useAuth } from '../auth/AuthContext'
import { usePageTransition } from '../lib/PageTransition'
import type { Tile } from '../game/tileset'

// ─── Hero tile data ────────────────────────────────────────────────────────
const HERO_TILES: Tile[] = [
  { name: 'b1',          url: '/assets/svgtiles/b1.svg',           suit: '🀐', index: 0 },
  { name: 'north',       url: '/assets/svgtiles/north.svg',        suit: '🀃', index: 1 },
  { name: 'd5',          url: '/assets/svgtiles/d5.svg',           suit: '🀝', index: 2 },
  { name: 'reddragon',   url: '/assets/svgtiles/dragon_red.svg',   suit: '🀄', index: 3 },
  { name: 'east',        url: '/assets/svgtiles/east.svg',         suit: '🀀', index: 4 },
  { name: 'greendragon', url: '/assets/svgtiles/dragon_green.svg', suit: '🀅', index: 5 },
  { name: 'c7',          url: '/assets/svgtiles/c7.svg',           suit: '🀍', index: 6 },
  { name: 'plum',        url: '/assets/svgtiles/plum.svg',         suit: '🀢', index: 7 },
  { name: 'b9',          url: '/assets/svgtiles/b9.svg',           suit: '🀘', index: 8 },
]

// Varied float amplitude, duration, phase per tile for organic movement
const FLOAT_CFG = [
  { amp: 7,  dur: 4200, delay: 400  },
  { amp: 9,  dur: 3600, delay: 1100 },
  { amp: 6,  dur: 5000, delay: 0    },
  { amp: 10, dur: 3900, delay: 800  },
  { amp: 8,  dur: 4500, delay: 200  },
  { amp: 7,  dur: 3300, delay: 1500 },
  { amp: 9,  dur: 4800, delay: 600  },
  { amp: 6,  dur: 3700, delay: 1200 },
  { amp: 8,  dur: 4100, delay: 300  },
]

// Ambient background particles — subtle floating shapes
const AMBIENT = [
  { size: 20, left: '6%',  top: '14%', delay: 0,    dur: 8000, opacity: 0.07 },
  { size: 14, left: '90%', top: '10%', delay: 2100, dur: 9500, opacity: 0.06 },
  { size: 16, left: '4%',  top: '72%', delay: 800,  dur: 7500, opacity: 0.07 },
  { size: 12, left: '92%', top: '62%', delay: 3400, dur: 6800, opacity: 0.05 },
  { size: 10, left: '48%', top: '88%', delay: 1600, dur: 11000, opacity: 0.04 },
]

const TILE_W  = 60   // lg tile width
const STEP    = 56   // horizontal gap between tile origins (< TILE_W = overlap)
const REVEAL_MS = 90 // ms between each tile being dealt

// ─── Hero tile cluster ─────────────────────────────────────────────────────
function HeroTileCluster() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount < HERO_TILES.length) {
      const t = setTimeout(() => setVisibleCount(v => v + 1), REVEAL_MS)
      return () => clearTimeout(t)
    }
  }, [visibleCount])

  return (
    // height accounts for arc offset (max ~72px) + tile height (84px) + padding
    <div className="relative w-full" style={{ height: 186 }} aria-hidden>
      {HERO_TILES.map((tile, i) => {
        if (i >= visibleCount) return null

        const offset   = i - 4                              // −4…+4
        const leftCalc = `calc(50% + ${offset * STEP - TILE_W / 2}px)`
        const top      = offset * offset * 4 + 20           // arc: centre at top
        const rot      = offset * 5.8                       // fan rotation
        const z        = 10 - Math.abs(offset)              // centre tiles on top
        const { amp, dur, delay } = FLOAT_CFG[i]

        return (
          <motion.div
            key={i}
            style={{ position: 'absolute', left: leftCalc, top, zIndex: z, rotate: rot }}
            whileHover={{
              y: -18,
              scale: 1.12,
              zIndex: 30,
              transition: { duration: 0.18, ease: 'easeOut' },
            }}
          >
            {/* float wrapper — CSS animation isolated to this element */}
            <div
              style={{
                animation: `heroFloat ${dur}ms ease-in-out infinite`,
                animationDelay: `${delay}ms`,
                '--float-amp': `${amp}px`,
              } as React.CSSProperties}
            >
              <TileFace tile={tile} size="lg" flipIn />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Landing page ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user } = useAuth()
  const { transitionTo } = usePageTransition()
  if (user) return <Navigate to="/lobby" replace />

  return (
    <div
      className="bg-paper min-h-screen flex flex-col relative overflow-hidden"
      style={{ fontFamily: 'var(--serif)', color: 'var(--ink)' }}
    >
      {/* Ambient floating particles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {AMBIENT.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              top: p.top,
              background: 'var(--seal)',
              opacity: p.opacity,
              animation: `ambientDrift ${p.dur}ms ease-in-out infinite`,
              animationDelay: `${p.delay}ms`,
            }}
          />
        ))}
      </div>

      {/* ── Tile scatter at top ── */}
      <div className="w-full pt-10 px-4" style={{ maxWidth: 780, margin: '0 auto' }}>
        <HeroTileCluster />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 pt-8 pb-16 gap-8">

        {/* Title */}
        <div className="text-center space-y-2">
          <p
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: 'var(--ink-faint)', fontFamily: 'var(--serif)' }}
          >
            Singapore Rules · 四人麻将
          </p>
          <h1
            className="text-6xl sm:text-7xl leading-none animate-title-glow"
            style={{ fontFamily: 'var(--display)', color: 'var(--ink)' }}
          >
            麻将之王
          </h1>
          <p
            className="text-base"
            style={{ color: 'var(--ink-soft)', fontFamily: 'var(--serif)' }}
          >
            Four-player online mahjong — play solo or challenge friends
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <button
            type="button"
            onClick={() => transitionTo('/practice')}
            className="animate-cta-glow w-full sm:flex-1 text-center rounded-lg px-6 py-3.5 font-semibold text-sm transition-all duration-150 active:scale-95 cursor-pointer"
            style={{
              background: 'var(--seal)',
              color: 'var(--ivory)',
              fontFamily: 'var(--serif)',
              border: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--seal-soft)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--seal)'
              e.currentTarget.style.transform = ''
            }}
          >
            Play Solo — No Account Needed
          </button>
        </div>

        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-1 h-px" style={{ background: 'var(--paper-edge)' }} />
          <span
            className="text-xs tracking-wide"
            style={{ color: 'var(--ink-faint)', fontFamily: 'var(--serif)' }}
          >
            or play with friends
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--paper-edge)' }} />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <Link
            to="/login"
            className="w-full sm:flex-1 text-center rounded-lg px-6 py-3 font-medium text-sm transition-all duration-150 active:scale-95"
            style={{
              background: 'var(--ivory)',
              color: 'var(--jade-shade)',
              border: '1px solid var(--jade)',
              boxShadow: 'var(--shadow-rest)',
              fontFamily: 'var(--serif)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--felt)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--ivory)'
              e.currentTarget.style.transform = ''
            }}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="w-full sm:flex-1 text-center rounded-lg px-6 py-3 font-medium text-sm transition-all duration-150 active:scale-95"
            style={{
              background: 'var(--jade)',
              color: 'var(--ivory)',
              boxShadow: 'var(--shadow-rest)',
              fontFamily: 'var(--serif)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--jade-shade)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--jade)'
              e.currentTarget.style.transform = ''
            }}
          >
            Create Account
          </Link>
        </div>
      </main>

      {/* Thin wood accent at bottom */}
      <div className="h-1 flex-shrink-0" style={{ background: 'var(--wood)' }} aria-hidden />
    </div>
  )
}
