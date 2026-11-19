import { ImageResponse } from "next/og";
import { theme } from "@/lib/theme";

export const alt = "Aircraft Turnaround Planner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colours come from the theme mirror; the yellow edge gets a dark rule so it holds up on the light ground.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: theme.ground,
          color: theme.ink,
          borderLeft: `24px solid ${theme.critical}`,
          boxShadow: `inset 4px 0 0 ${theme.criticalInk}`,
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>
          Aircraft Turnaround Planner
        </div>
        <div style={{ marginTop: 32, fontSize: 38, color: theme.muted, lineHeight: 1.3, display: "flex" }}>
          See how delays move an aircraft&apos;s departure, using critical path scheduling.
        </div>
      </div>
    ),
    { ...size },
  );
}
