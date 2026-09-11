import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const ReelPayoffText: React.FC<{
  text: string;
  fontFamily: string;
  aspect: "vertical" | "feed";
  from: number;
}> = ({ text, fontFamily, aspect, from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - from,
    fps,
    config: { damping: 22, stiffness: 120 },
    durationInFrames: 28,
  });
  const scale = interpolate(s, [0, 1], [0.92, 1]);
  const opacity = interpolate(s, [0, 1], [0, 1]);

  const bottom = aspect === "feed" ? 300 : 360;
  const fontSize = aspect === "feed" ? 50 : 56;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: bottom,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight: 700,
          letterSpacing: -1.2,
          color: COLORS.text,
          textAlign: "center",
          lineHeight: 1.1,
          textShadow: "0 10px 30px rgba(0,0,0,0.55)",
          transform: `scale(${scale})`,
          maxWidth: 900,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
