import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const BrandCard: React.FC<{
  variant: "brand-open" | "brand-close";
  duration: number;
  display: string;
  body: string;
}> = ({ variant, duration, display, body }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 120 }, durationInFrames: 34 });
  const scale = interpolate(s, [0, 1], [0.86, 1]);
  const lineW = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 200 }, durationInFrames: 30 }),
    [0, 1],
    [0, 420]
  );
  const out = interpolate(frame, [duration - 14, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isClose = variant === "brand-close";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: isClose ? "center" : "flex-start",
        paddingLeft: isClose ? 0 : 200,
        opacity: out,
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: isClose ? "center" : "left center" }}>
        <div
          style={{
            fontFamily: display,
            fontSize: isClose ? 150 : 118,
            fontWeight: 700,
            letterSpacing: -6,
            color: COLORS.text,
            lineHeight: 1,
          }}
        >
          exotiq
        </div>
        <div
          style={{
            height: 3,
            width: lineW,
            marginTop: 26,
            marginLeft: isClose ? "auto" : 0,
            marginRight: isClose ? "auto" : 0,
            background: `linear-gradient(90deg, ${COLORS.accent}, rgba(59,130,246,0))`,
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontFamily: body,
            fontSize: isClose ? 40 : 36,
            color: COLORS.muted,
            letterSpacing: isClose ? 6 : -0.2,
            textTransform: isClose ? "uppercase" : "none",
            textAlign: isClose ? "center" : "left",
          }}
        >
          {isClose ? "Your fleet, commanded" : "The command center for exotic rental fleets"}
        </div>
      </div>
    </AbsoluteFill>
  );
};
