import { LogoMark } from "../../components/Logo";

export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center gradient-hero text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-fuchsia-500/30 blur-3xl animate-float" />
        <div className="absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl animate-float [animation-delay:1.5s]" />
      </div>
      <div className="relative flex flex-col items-center">
        <div className="animate-pop"><LogoMark className="h-24 w-24 drop-shadow-2xl" animated /></div>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight animate-fade-up [animation-delay:.3s]">EduWay AI</h1>
        <p className="mt-2 text-white/75 animate-fade-up [animation-delay:.5s]">Kelajagingiz sari aqlli yo'l</p>
        <div className="mt-10 h-1 w-32 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-1/2 rounded-full bg-white animate-[shimmer_1.2s_linear_infinite]" style={{ backgroundImage: "linear-gradient(90deg,transparent,#fff,transparent)", backgroundSize: "200% 100%" }} />
        </div>
      </div>
    </div>
  );
}
