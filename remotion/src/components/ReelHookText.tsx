import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const ReelHookText: React.FC<{
  text: string;
  fontFamily: string;
  aspect: "vertical" | "feed";
}> = ({ text, fontFamily, aspect }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 120 }, durationInFrames: 26 });
  const scale = interpolate(s, [0, 1], [0.92, 1]);
  const opacity = interpolate(frame, [60, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const top = aspect === "feed" ? 140 : 200;
  const fontSize = aspect === "feed" ? 64 : 70;
  const paddingX = aspect === "feed" ? 60 : 70;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: top,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight: 700,
          letterSpacing: -1.6,
          color: COLORS.text,
          textAlign: "center",
          lineHeight: 1.08,
          textShadow: "0 12px 34px rgba(0,0,0,0.55)",
          transform: `scale(${scale})`,
          maxWidth: 900,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
