import { motion } from 'framer-motion'

// Live keeps the existing brand teal (border, icon, pill) rather than the
// design brief's own slightly different #22d3ee — the hybrid palette
// decision: every "Live"/CTA-adjacent signal on this page reads the same
// teal the Draft Room and the logo already use, so a room going from
// "Coming soon" to live one day doesn't introduce a second teal next to it.
export default function RoomCard({ room, onComingSoon }) {
  const live = room.live

  const content = (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={
        'group flex h-full min-h-[216px] flex-col gap-[13px] rounded-[14px] border p-[26px] text-left transition-colors duration-150 ' +
        (live
          ? 'border-teal-400/40 hover:border-teal-400/70'
          : 'border-white/[0.07] bg-[#0c1013] hover:border-teal-400/45')
      }
      style={
        live
          ? { background: 'linear-gradient(170deg, rgba(0,229,255,0.09), #0d1216 62%)' }
          : undefined
      }
    >
      <div className="flex items-center gap-[13px]">
        <div
          className={
            'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] ' +
            (live ? 'bg-white/5 text-teal-300' : 'bg-white/5 text-white/45')
          }
        >
          {room.icon}
        </div>
        <h3 className="font-display text-[17.5px] font-bold text-white">{room.name}</h3>
      </div>

      {room.lead && <p className="text-[15px] font-bold text-[#cbd5da]">{room.lead}</p>}

      <p className="flex-1 text-[14.5px] leading-[1.55] text-[#8b979e]">{room.blurb}</p>

      <span
        className={
          'inline-flex w-fit items-center gap-[6px] self-start rounded-full px-3 py-[5px] font-plex text-[10.5px] font-semibold ' +
          (live ? 'bg-teal-500/[0.14] text-teal-300' : 'bg-white/5 text-white/45')
        }
      >
        <span className={'h-[5px] w-[5px] rounded-full ' + (live ? 'bg-teal-400' : 'bg-white/35')} />
        {live ? 'Live' : 'Coming soon'}
      </span>
    </motion.div>
  )

  if (live && room.href) {
    return (
      <a href={room.href} className="block h-full">
        {content}
      </a>
    )
  }

  // Not live: the whole card is a button rather than a dead surface — opens
  // the same ComingSoonModal Header.jsx already uses for Log in/Sign Up,
  // with copy specific to this room, instead of doing nothing. The design
  // brief left this an open question ("decide whether these are inert or
  // open a waitlist affordance"); there's no waitlist to sign up for, so
  // the honest answer already built into this codebase is the same one
  // used everywhere else something isn't live yet.
  return (
    <button type="button" onClick={() => onComingSoon?.(room)} className="block h-full w-full">
      {content}
    </button>
  )
}
