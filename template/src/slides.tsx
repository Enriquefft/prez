import { Slide, Notes } from 'prez'

export default function Slides() {
  return (
    <>
      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white">
          <h1 className="text-7xl font-bold tracking-tight">Your Title Here</h1>
          <p className="mt-6 text-2xl text-white/60">A subtitle that sets the stage</p>
        </div>
        <Notes>Welcome everyone. This is the opening slide.</Notes>
      </Slide>

      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-white text-gray-900 p-20">
          <h2 className="text-5xl font-bold mb-12">The Problem</h2>
          <p className="text-2xl text-gray-600 max-w-3xl text-center leading-relaxed">
            Creating presentations is painful. You leave your IDE, open a slide tool,
            fight with layouts, and lose the context of your codebase.
          </p>
        </div>
        <Notes>Explain the pain point. Pause for effect.</Notes>
      </Slide>

      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-20">
          <h2 className="text-5xl font-bold mb-12">The Solution</h2>
          <div className="grid grid-cols-3 gap-8 max-w-4xl">
            <div className="text-center">
              <div className="text-6xl mb-4">1</div>
              <p className="text-lg text-white/70">Tell Claude what you want</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">2</div>
              <p className="text-lg text-white/70">It reads your codebase</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">3</div>
              <p className="text-lg text-white/70">Beautiful deck, instantly</p>
            </div>
          </div>
        </div>
        <Notes>Walk through the three steps. Keep it simple.</Notes>
      </Slide>

      <Slide>
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white">
          <h2 className="text-6xl font-bold">Thank You</h2>
          <p className="mt-4 text-xl text-white/80">Arrow keys to navigate. F for fullscreen. Alt+Shift+P for presenter mode.</p>
        </div>
      </Slide>
    </>
  )
}
