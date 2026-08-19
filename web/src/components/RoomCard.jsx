import { motion } from 'framer-motion'

export default function RoomCard({ room }) {
  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative flex h-full w-full flex-col justify-between rounded-2xl glass-panel p-6 text-left
                 shadow-glass transition-colors duration-300 ease-out
                 hover:border-teal/70 hover:shadow-card-hover"
    >
      <div>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-teal">
          {room.icon}
        </div>
        <h3 className="font-display text-lg font-semibold text-white">{room.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{room.blurb}</p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ' +
            (room.live ? 'bg-teal/15 text-teal' : 'bg-white/5 text-white/40')
          }
        >
          <span className={'h-1.5 w-1.5 rounded-full ' + (room.live ? 'bg-teal' : 'bg-white/30')} />
          {room.live ? 'Live' : 'Coming soon'}
        </span>

        {room.live && room.href && (
          <a
            href={room.href}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-white/40 opacity-0 transition-opacity duration-300 hover:text-teal group-hover:opacity-100"
          >
            Enter &rarr;
          </a>
        )}
      </div>
    </motion.div>
  )
}
