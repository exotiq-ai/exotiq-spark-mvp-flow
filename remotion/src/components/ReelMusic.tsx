import React from "react";
import { Audio, interpolate, staticFile, useCurrentFrame } from "remotion";

export const ReelMusic: React.FC<{
  narration: { from: number; duration: number }[];
  endCardFrom: number;
  endCardDuration: number;
}> = ({ narration, endCardFrom, endCardDuration }) => {
  const frame = useCurrentFrame();

  const ranges: number[] = [];
  const values: number[] = [];
  const add = (f: number, v: number) => {
    ranges.push(f);
    values.push(v);
  };

  const FADE = 5;

  add(0, 0.55);

  for (const seg of narration) {
    add(Math.max(0, seg.from - FADE), 0.55);
    add(seg.from, 0.08);
    add(seg.from + seg.duration, 0.08);
    add(seg.from + seg.duration + FADE, 0.55);
  }

  const cta = narration[narration.length - 1];
  const riseStart = cta.from + cta.duration + 15;
  add(riseStart, 0.55);
  add(endCardFrom, 0.82);
  add(endCardFrom + endCardDuration, 0.92);

  const volume = interpolate(frame, ranges, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <Audio src={staticFile("audio/reels/music-bed.mp3")} volume={volume} />;
};
