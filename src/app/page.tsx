"use client";

import { useState } from "react";

import { StartScreen } from "@/ui/tv/StartScreen";
import { TvShell } from "@/ui/tv/TvShell";

export default function Page() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <div
        className="h-full"
        onDoubleClick={() => setStarted(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") setStarted(true);
        }}
      >
        <StartScreen onStart={() => setStarted(true)} />
      </div>
    );
  }

  return <TvShell />;
}
