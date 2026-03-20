import { Notes, Slide } from 'prez'

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-6xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-lg text-white/50 uppercase tracking-widest">
        {label}
      </div>
    </div>
  )
}

function TeamMember({
  name,
  role,
  color,
}: {
  name: string
  role: string
  color: string
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-16 h-16 rounded-full ${color} flex items-center justify-center text-2xl font-bold text-white/90`}
      >
        {name[0]}
      </div>
      <div>
        <div className="text-xl font-semibold">{name}</div>
        <div className="text-white/50">{role}</div>
      </div>
    </div>
  )
}

export default function Slides() {
  return (
    <>
      {/* Slide 1: Title */}
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-600/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[120px]" />
          <div className="relative z-10 text-center">
            <div className="animate-fade-up text-sm tracking-[0.4em] uppercase text-violet-400 mb-6">
              Series A
            </div>
            <h1 className="animate-fade-up-delay text-8xl font-black tracking-tighter bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Acme AI
            </h1>
            <p className="animate-fade-up-delay-2 mt-6 text-2xl text-white/40 max-w-xl mx-auto">
              AI infrastructure for the next million developers
            </p>
          </div>
          <div className="absolute bottom-8 text-sm text-white/20 animate-pulse-slow">
            Press space or arrows to navigate
          </div>
        </div>
        <Notes>
          Open strong. Pause 2 seconds on the title before speaking. "Thank you
          for having us. We're Acme AI, and we're building the infrastructure
          layer for AI-native development."
        </Notes>
      </Slide>

      {/* Slide 2: Problem */}
      <Slide>
        <div className="flex flex-col justify-center h-full bg-[#0a0a0a] text-white px-24">
          <div className="max-w-4xl">
            <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-4">
              The Problem
            </p>
            <h2 className="text-5xl font-bold leading-tight">
              Every company wants AI.
              <br />
              <span className="text-white/30">
                Nobody knows how to ship it.
              </span>
            </h2>
            <div className="mt-16 grid grid-cols-3 gap-8">
              <div className="border-l-2 border-red-500/50 pl-6">
                <div className="text-3xl font-bold text-red-400">73%</div>
                <div className="mt-2 text-white/40">
                  of AI projects never reach production
                </div>
              </div>
              <div className="border-l-2 border-orange-500/50 pl-6">
                <div className="text-3xl font-bold text-orange-400">6 mo</div>
                <div className="mt-2 text-white/40">
                  average time to first AI feature
                </div>
              </div>
              <div className="border-l-2 border-yellow-500/50 pl-6">
                <div className="text-3xl font-bold text-yellow-400">$2.1M</div>
                <div className="mt-2 text-white/40">
                  wasted per failed AI initiative
                </div>
              </div>
            </div>
          </div>
        </div>
        <Notes>
          Let the stats sink in. These are from Gartner 2025 and our own
          customer interviews. "The gap between wanting AI and shipping AI is
          enormous."
        </Notes>
      </Slide>

      {/* Slide 3: Solution */}
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white">
          <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-8">
            The Solution
          </p>
          <h2 className="text-5xl font-bold text-center max-w-3xl leading-tight">
            Ship AI features in
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              {' '}
              hours, not months
            </span>
          </h2>
          <div className="mt-16 flex items-center gap-6">
            <div className="flex flex-col items-center gap-3 w-48">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-3xl">
                1
              </div>
              <span className="text-sm text-white/50 text-center">
                Connect your data
              </span>
            </div>
            <div className="w-12 h-px bg-white/10" />
            <div className="flex flex-col items-center gap-3 w-48">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-3xl">
                2
              </div>
              <span className="text-sm text-white/50 text-center">
                Pick a template
              </span>
            </div>
            <div className="w-12 h-px bg-white/10" />
            <div className="flex flex-col items-center gap-3 w-48">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">
                3
              </div>
              <span className="text-sm text-white/50 text-center">
                Deploy to production
              </span>
            </div>
          </div>
        </div>
        <Notes>
          Keep this high-level. The three steps map to our core product flow.
          Click through each and pause.
        </Notes>
      </Slide>

      {/* Slide 4: Traction */}
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white">
          <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-12">
            Traction
          </p>
          <div className="grid grid-cols-4 gap-16">
            <Metric value="12K" label="Developers" />
            <Metric value="$3.2M" label="ARR" />
            <Metric value="180%" label="YoY Growth" />
            <Metric value="94%" label="Retention" />
          </div>
          <div className="mt-20 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="mt-8 flex gap-12 items-center">
            {['Stripe', 'Vercel', 'Linear', 'Notion', 'Figma'].map((name) => (
              <span
                key={name}
                className="text-white/20 text-lg font-medium tracking-wide"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
        <Notes>
          Hit each metric hard. 180% YoY is our strongest number. The logos are
          real customers — mention Stripe specifically if asked.
        </Notes>
      </Slide>

      {/* Slide 5: Business Model */}
      <Slide>
        <div className="flex flex-col justify-center h-full bg-[#0a0a0a] text-white px-24">
          <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-4">
            Business Model
          </p>
          <h2 className="text-4xl font-bold mb-16">
            Usage-based pricing that scales with value
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
              <div className="text-white/40 text-sm uppercase tracking-wider">
                Starter
              </div>
              <div className="text-3xl font-bold mt-3">Free</div>
              <div className="text-white/30 mt-1 text-sm">
                Up to 1K requests/mo
              </div>
              <div className="mt-6 space-y-2 text-sm text-white/50">
                <div>Community support</div>
                <div>3 templates</div>
                <div>1 project</div>
              </div>
            </div>
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-8 px-3 py-1 bg-violet-500 text-xs font-semibold rounded-full">
                Popular
              </div>
              <div className="text-violet-300 text-sm uppercase tracking-wider">
                Pro
              </div>
              <div className="text-3xl font-bold mt-3">
                $99
                <span className="text-lg font-normal text-white/40">/mo</span>
              </div>
              <div className="text-white/30 mt-1 text-sm">
                Up to 100K requests/mo
              </div>
              <div className="mt-6 space-y-2 text-sm text-white/50">
                <div>Priority support</div>
                <div>All templates</div>
                <div>Unlimited projects</div>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
              <div className="text-white/40 text-sm uppercase tracking-wider">
                Enterprise
              </div>
              <div className="text-3xl font-bold mt-3">Custom</div>
              <div className="text-white/30 mt-1 text-sm">Unlimited</div>
              <div className="mt-6 space-y-2 text-sm text-white/50">
                <div>Dedicated support</div>
                <div>Custom templates</div>
                <div>SLA + SOC2</div>
              </div>
            </div>
          </div>
        </div>
        <Notes>
          Average contract value is $14K/year. Enterprise deals are 6-figure.
          Net revenue retention is 140%.
        </Notes>
      </Slide>

      {/* Slide 6: Team */}
      <Slide>
        <div className="flex flex-col justify-center h-full bg-[#0a0a0a] text-white px-24">
          <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-4">
            Team
          </p>
          <h2 className="text-4xl font-bold mb-16">
            Built by operators who've done it before
          </h2>
          <div className="grid grid-cols-2 gap-x-16 gap-y-10">
            <TeamMember name="Sarah Chen" color="bg-violet-600" />
            <TeamMember name="James Park" color="bg-cyan-600" />
            <TeamMember name="Maria Garcia" color="bg-emerald-600" />
            <TeamMember name="Alex Kim" color="bg-orange-600" />
          </div>
          <div className="mt-12 text-white/30 text-sm">
            32 employees across SF, NYC, and London. Hiring aggressively.
          </div>
        </div>
        <Notes>
          Brief bios only. The key point: we've all scaled products at top
          companies. James has 12 ML papers. Maria scaled Vercel's eng org 5x.
        </Notes>
      </Slide>

      {/* Slide 7: The Ask */}
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-600/10" />
          <div className="relative z-10 text-center">
            <p className="text-violet-400 text-sm tracking-[0.3em] uppercase mb-6">
              The Ask
            </p>
            <h2 className="text-6xl font-black">
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                $18M
              </span>{' '}
              Series A
            </h2>
            <p className="mt-6 text-xl text-white/40 max-w-2xl mx-auto">
              To hire 20 engineers, expand to Europe, and launch enterprise tier
            </p>
            <div className="mt-16 flex gap-16 justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold">24 mo</div>
                <div className="text-sm text-white/30 mt-1">Runway</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">$15M</div>
                <div className="text-sm text-white/30 mt-1">ARR target</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">50K</div>
                <div className="text-sm text-white/30 mt-1">Developers</div>
              </div>
            </div>
          </div>
        </div>
        <Notes>
          Be direct. "$18M to get to $15M ARR in 24 months." We already have
          term sheets. This meeting is about partnership, not desperation.
        </Notes>
      </Slide>

      {/* Slide 8: Close */}
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-600/20" />
          <div className="relative z-10 text-center">
            <h2 className="text-7xl font-black tracking-tighter bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Acme AI
            </h2>
            <p className="mt-6 text-xl text-white/40">sarah@acme.ai</p>
            <div className="mt-12 w-32 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto" />
            <p className="mt-6 text-sm text-white/20">Built with prez</p>
          </div>
        </div>
        <Notes>
          End with confidence. "We'd love to have you on this journey."
        </Notes>
      </Slide>
    </>
  )
}
