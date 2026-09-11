import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Rect } from "../reels";
import { COLORS } from "../theme";

const SHOT_W = 1920;
const SHOT_H = 1080;

export const ReelShotFrame: React.FC<{
  shot: string;
  from: Rect;
  to: Rect;
  duration: number;
  aspect: "vertical" | "feed";
}> = ({ shot, from, to, duration, aspect }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => x,
  });

  const lerp = (a: number, b: number) => a + (b - a) * t;
  const rw = lerp(from.w, to.w);
  const rx = lerp(from.x, to.x);
  const ry = lerp(from.y, to.y);
  const rh = lerp(from.h, to.h);

  const vw = aspect === "feed" ? 1000 : 1000;
  const vh = aspect === "feed" ? 1230 : 1778;
  const scale = Math.max(vw / rw, vh / rh);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: vw,
          height: vh,
          overflow: "hidden",
          borderRadius: 22,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 60px 140px rgba(0,0,0,0.65)",
          background: COLORS.panel,
          position: "relative",
        }}
      >
        <Img
          src={staticFile(`shots/${shot}`)}
          style={{
            position: "absolute",
            width: SHOT_W * scale,
            height: SHOT_H * scale,
            left: vw / 2 - cx * scale,
            top: vh / 2 - cy * scale,
            filter: "brightness(1.08) contrast(1.04) saturate(1.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(4,5,7,0.65) 100%)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
