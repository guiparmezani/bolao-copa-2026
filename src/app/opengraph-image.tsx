import { ImageResponse } from "next/og";

export const alt = "Bolão dos Facabundos Copa 2026";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#071d17",
          color: "#f7ffe2",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 20%, rgba(255, 211, 57, 0.5), transparent 28%), radial-gradient(circle at 78% 32%, rgba(0, 82, 204, 0.42), transparent 28%), linear-gradient(135deg, #063f2a 0%, #09251d 48%, #071d17 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 34,
            border: "3px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 34,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 78,
            top: 70,
            width: 104,
            height: 104,
            borderRadius: 24,
            background: "#ffd339",
            color: "#08351f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 950,
            letterSpacing: 0,
          }}
        >
          BF
        </div>
        <div
          style={{
            position: "absolute",
            left: 82,
            top: 216,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            width: 760,
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#ffd339",
              fontSize: 30,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Copa do Mundo 2026
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              fontWeight: 950,
              lineHeight: 0.92,
              letterSpacing: 0,
            }}
          >
            Bolão dos Facabundos
          </div>
          <div
            style={{
              display: "flex",
              color: "#d9f6df",
              fontSize: 31,
              fontWeight: 800,
              lineHeight: 1.25,
            }}
          >
            Palpites, ranking e jogos em uma resenha só.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 86,
            bottom: 76,
            width: 270,
            height: 270,
            borderRadius: 999,
            background: "#f7ffe2",
            color: "#07341f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 116,
            boxShadow: "0 28px 80px rgba(0, 0, 0, 0.35)",
          }}
        >
          ⚽
        </div>
        <div
          style={{
            position: "absolute",
            right: 94,
            top: 88,
            width: 250,
            height: 84,
            borderRadius: 999,
            border: "3px solid rgba(255, 211, 57, 0.85)",
            color: "#ffd339",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 950,
          }}
        >
          🇧🇷 2026
        </div>
      </div>
    ),
    size,
  );
}
