import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Rect } from "../timeline";
import { COLORS } from "../theme";

const W = 1920;
const H = 1080;

/**
 * Renders a 1920x1080 screenshot cropped/zoomed to a focus rect, animated
 * from -> to across the segment duration.
 */
export const ShotFrame: React.FC<{
  shot: string;
  from: Rect;
  to: Rect;
  duration: number;
}> = ({ shot, from, to, duration }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => x, // linear drift; entrances handled by wrapper
  });

  const lerp = (a: number, b: number) => a + (b - a) * t;
  const rw = lerp(from.w, to.w);
  const rx = lerp(from.x, to.x);
  const ry = lerp(from.y, to.y);
  const rh = lerp(from.h, to.h);

  // viewport for the framed screenshot
  const vw = 1600;
  const vh = 900;
  const scale = Math.max(vw / rw, vh / rh);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  const intro = interpolate(frame, [0, 14], [0.965, 1], {
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity }}>
      <div
        style={{
          width: vw,
          height: vh,
          overflow: "hidden",
          borderRadius: 22,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 60px 140px rgba(0,0,0,0.65)",
          transform: `scale(${intro})`,
          background: COLORS.panel,
          position: "relative",
        }}
      >
        <Img
          src={staticFile(`shots/${shot}`)}
          style={{
            position: "absolute",
            width: W * scale,
            height: H * scale,
            left: vw / 2 - cx * scale,
            top: vh / 2 - cy * scale,
            filter: "brightness(1.1) contrast(1.04) saturate(1.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(4,5,7,0.55) 100%)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
