import { useState } from 'react'
import Header from './Header.jsx'
import LiveScoresTicker from './LiveScoresTicker.jsx'
import ResumeBanner from './ResumeBanner.jsx'
import Hero from './Hero.jsx'
import RoomNavigation from './RoomNavigation.jsx'
import ShowYourWorking from './ShowYourWorking.jsx'

export default function Homepage() {
  // The ticker is fixed and out of flow, so it reserves no space of its own —
  // <main>'s top padding has to know whether it's there (h-16 header alone vs
  // h-16 + h-12 header+ticker), or an offseason visitor (no games, ticker
  // renders nothing) gets a permanent gap sized for a bar that isn't shown.
  const [hasScores, setHasScores] = useState(false)

  return (
    <div className="min-h-screen overflow-x-hidden bg-obsidian text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(600px circle at 15% 10%, rgba(0,229,255,0.10), transparent 60%),' +
            'radial-gradient(700px circle at 85% 25%, rgba(123,31,162,0.14), transparent 60%)',
        }}
      />

      <Header />
      <LiveScoresTicker onGamesChange={setHasScores} />

      <main className={'relative ' + (hasScores ? 'pt-28' : 'pt-16')}>
        <ResumeBanner />
        <Hero />

        <section id="rooms" className="mx-auto max-w-7xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold italic tracking-tight sm:text-4xl">The Rooms</h2>
            <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
              One home for every decision in a fantasy season — mock drafts today, waivers
              and trades as the year goes on.
            </p>
          </div>

          <div className="mt-16">
            <RoomNavigation />
          </div>
        </section>

        <ShowYourWorking />
      </main>

      <footer className="relative border-t border-white/5 py-8 text-center text-xs text-white/30">
        Juke runs entirely in your browser. Nothing you draft is sent anywhere.
      </footer>
    </div>
  )
}
