"use client";

export function BorderBeam() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <div
        className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(120,120,120,0.6) 305deg, rgba(255,255,255,0.95) 320deg, rgba(120,120,120,0.6) 335deg, transparent 360deg)",
          animation: "border-beam-spin 8s linear infinite",
        }}
      />
      <div className="absolute inset-[1.5px] rounded-[14.5px] bg-background" />
    </div>
  );
}
