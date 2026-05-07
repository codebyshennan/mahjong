import { motion, useReducedMotion } from 'framer-motion'
import type { Tile } from '../game/tileset'

export type TileSize = 'sm' | 'md' | 'lg'
export type TileOrientation = 0 | 90 | 180 | 270

const SIZE: Record<TileSize, { w: number; h: number; r: number }> = {
  sm: { w: 30, h: 42, r: 4 },
  md: { w: 44, h: 62, r: 6 },
  lg: { w: 60, h: 84, r: 8 },
}

interface TileProps {
  tile?: Tile
  size?: TileSize
  faceDown?: boolean
  rotation?: TileOrientation
  onClick?: () => void
  selectable?: boolean
  highlight?: boolean
  layoutId?: string
  /** Run a card-flip entrance animation on mount. */
  flipIn?: boolean
  /** Pulse a soft amber glow (e.g. "the freshly drawn tile"). */
  pulse?: boolean
}

export function TileFace({
  tile,
  size = 'md',
  faceDown = false,
  rotation = 0,
  onClick,
  selectable = false,
  highlight = false,
  layoutId,
  flipIn = false,
  pulse = false,
}: TileProps) {
  const dims = SIZE[size]
  const interactive = !!onClick && selectable
  const reduce = useReducedMotion()
  const isQuarterTurn = rotation === 90 || rotation === 270

  const initial =
    flipIn && !reduce
      ? { rotateY: 180, scale: 0.7, opacity: 0 }
      : { opacity: 0, scale: 0.9 }
  const animate =
    flipIn && !reduce
      ? { rotateY: 0, scale: 1, opacity: 1 }
      : { opacity: 1, scale: 1 }

  const button = (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      disabled={!interactive}
      title={tile?.name ?? ''}
      initial={initial}
      animate={animate}
      whileHover={interactive ? { y: -10, scale: 1.04 } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      transition={
        flipIn
          ? { type: 'spring', stiffness: 220, damping: 18, mass: 0.9 }
          : { type: 'spring', stiffness: 380, damping: 26 }
      }
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: dims.r,
        cursor: interactive ? 'pointer' : 'default',
        transformStyle: 'preserve-3d',
      }}
      className={[
        'relative shrink-0 select-none p-0 outline-none',
        'shadow-[0_2px_0_0_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.5)]',
        faceDown
          ? 'bg-gradient-to-b from-emerald-700 to-emerald-900 ring-1 ring-emerald-950'
          : 'bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-stone-400',
        highlight ? 'ring-2 ring-amber-400 shadow-amber-500/40' : '',
        pulse ? 'animate-pulse-glow' : '',
        interactive ? 'focus-visible:ring-2 focus-visible:ring-emerald-400' : '',
      ].join(' ')}
    >
      {!faceDown && tile && (
        <>
          {/* glossy highlight */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[inherit] bg-gradient-to-b from-white/70 to-transparent opacity-80"
          />
          <img
            src={tile.url}
            alt={tile.name}
            draggable={false}
            className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain"
          />
        </>
      )}
      {faceDown && (
        <span
          aria-hidden
          className="absolute inset-1.5 rounded-sm border border-emerald-950/50 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.15)_0_4px,transparent_4px_8px)]"
        />
      )}
    </motion.button>
  )

  if (isQuarterTurn) {
    return (
      <span
        className="relative inline-block shrink-0"
        style={{ width: dims.h, height: dims.w }}
      >
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: dims.w,
            height: dims.h,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {button}
        </span>
      </span>
    )
  }
  if (rotation) {
    return (
      <span
        className="inline-block shrink-0"
        style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
      >
        {button}
      </span>
    )
  }
  return button
}

/** A row of face-down tile backs — used for opponents' concealed hands. */
export function HandBacks({
  count,
  size = 'sm',
  rotation = 0,
}: {
  count: number
  size?: TileSize
  rotation?: TileOrientation
}) {
  const isVertical = rotation === 90 || rotation === 270
  return (
    <div
      className={`flex ${isVertical ? 'flex-col' : 'flex-row flex-wrap'} gap-0.5 justify-center`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <TileFace key={i} faceDown size={size} rotation={rotation} />
      ))}
    </div>
  )
}

/** Compact fanned stack of face-down tiles for mobile opponent display. */
export function MobileFanBacks({
  count,
  rotation = 0,
  max = 7,
}: {
  count: number
  rotation?: TileOrientation
  max?: number
}) {
  const isSide = rotation === 90 || rotation === 270
  const show = Math.min(max, count)

  if (isSide) {
    // Vertical fan — tiles stacked top-to-bottom, rotated to face the board center
    // sm tile DOM: 30(w)×42(h); visually 42(w)×30(h) when rotated 90/270°
    const STEP = 14
    const containerH = 42 + (show - 1) * STEP
    return (
      <div style={{ position: 'relative', height: containerH, width: 54 }}>
        {Array.from({ length: show }).map((_, i) => {
          const spread = show <= 1 ? 0 : i / (show - 1) - 0.5
          const lean = spread * 20
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: i * STEP,
                left: '50%',
                transform: `translateX(-50%) rotate(${lean}deg)`,
                transformOrigin: '50% 50%',
                zIndex: i,
              }}
            >
              <TileFace faceDown size="sm" rotation={rotation} />
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal fan — top player facing down toward user
  const OVERLAP = 14
  const TILE_W = 30
  const totalW = TILE_W + (show - 1) * (TILE_W - OVERLAP)
  const fanSpread = Math.min(30, show * 2.5)  // wider spread for more tiles, capped
  return (
    <div style={{ position: 'relative', width: totalW, height: 56 }}>
      {Array.from({ length: show }).map((_, i) => {
        const spread = show <= 1 ? 0 : i / (show - 1) - 0.5
        const rotate = spread * fanSpread
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i * (TILE_W - OVERLAP),
              bottom: 0,
              zIndex: i,
              transform: `rotate(${rotate}deg)`,
              transformOrigin: '50% 100%',
            }}
          >
            <TileFace faceDown size="sm" />
          </div>
        )
      })}
    </div>
  )
}
