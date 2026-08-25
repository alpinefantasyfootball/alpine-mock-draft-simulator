import { motion } from 'framer-motion'

// Live keeps the existing brand teal (border, icon, pill) on purpose — it is
// a status colour, not the action colour, and stays put even after the
// page's primary CTAs moved to the newer cyan/violet gradient (Hero.jsx,
// ClosingCta.jsx, SiteNav.jsx, Header.jsx, and this grid's own mobile "Enter
// the ... Room" button). The two are allowed to differ: "Live" is answering
// "is this room open," the CTA is answering "click here" — the same
// teal-acts/blue-states split this project already draws elsewhere, just
// with a status colour on one side instead of a second action colour.
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

      {/* text-white/45 measured 4.45:1 here — just under §9's 4.5 bar,
          found during homepage v4 pass 3's contrast audit. #8e9aa1: same
          solid-colour fix as everywhere else in that pass, not a new
          token invented for this one chip. */}
      <span
        className={
          'inline-flex w-fit items-center gap-[6px] self-start rounded-full px-3 py-[5px] font-plex text-[10.5px] font-semibold ' +
          (live ? 'bg-teal-500/[0.14] text-teal-300' : 'bg-white/5')
        }
        style={live ? undefined : { color: '#8e9aa1' }}
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
