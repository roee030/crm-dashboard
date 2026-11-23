export function AudioPlayer({ src }: { src: string | null }) {
  if (!src) {
    return (
      <p className="text-sm text-slate-500">No audio file attached to this call.</p>
    );
  }
  return (
    <audio controls preload="none" src={src} className="w-full">
      Your browser does not support audio playback.
    </audio>
  );
}
