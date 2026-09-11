import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

export const ReelEndCard: React.FC<{
  display: string;
  body: string;
  from: number;
}> = ({ display, body, from }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, Math.max(0, (frame - from) / 20));
  const scale = interpolate(progress, [0, 1], [0.92, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(4,5,7,0.94)",
        opacity,
        zIndex: 100,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: display,
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -3,
            color: COLORS.text,
            lineHeight: 1,
          }}
        >
          @exotiq_ai
        </div>
        <div
          style={{
            height: 3,
            width: 260,
            margin: "28px auto",
            background: `linear-gradient(90deg, ${COLORS.accent}, rgba(59,130,246,0))`,
          }}
        />
        <div
          style={{
            fontFamily: body,
            fontSize: 38,
            color: COLORS.muted,
            letterSpacing: 2,
          }}
        >
          exotiq.ai
        </div>
      </div>
    </AbsoluteFill>
  );
};
