import { ImageResponse } from "next/og";

/**
 * Wspolny obrazek Open Graph.
 *
 * Powstal, bo link do serwisu wklejony na Facebooku, Messengerze czy forum
 * pokazywal pusta ramke — a to sa miejsca, w ktorych ludzie realnie wymieniaja
 * sie ofertami aut. Kazde takie udostepnienie szlo do kosza.
 *
 * Rysuje to satori, nie przegladarka: obsluguje wylacznie flexbox, a kazdy
 * element z wiecej niz jednym dzieckiem MUSI miec jawne `display: flex`.
 * Stad brak siatek i pelne `style` zamiast klas.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const INK = "#0b0d10";
const LINE = "#232a32";
const PANEL = "#14181d";

export function ogImage({
  eyebrow,
  title,
  subtitle,
  stats,
}: {
  /** Krotki nadpis nad tytulem, np. "BMW · po leasingu". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Do czterech liczb w stopce obrazka. */
  stats?: { label: string; value: string }[];
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: INK,
        padding: 64,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow && (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#8b95a1",
              letterSpacing: 1,
              marginBottom: 18,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: title.length > 42 ? 60 : 76,
            fontWeight: 700,
            color: "#f2f5f9",
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#8b95a1",
              marginTop: 20,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {stats && stats.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginBottom: 34 }}>
            {stats.slice(0, 4).map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: PANEL,
                  border: `1px solid ${LINE}`,
                  borderRadius: 14,
                  padding: "16px 22px",
                }}
              >
                <div style={{ display: "flex", fontSize: 19, color: "#6b7280" }}>{s.label}</div>
                <div
                  style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#f2f5f9" }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${LINE}`,
            paddingTop: 26,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#f2f5f9" }}>auto</span>
          <span style={{ color: "#f2f5f9" }}>poleasingu</span>
          <span style={{ color: "#525a66" }}>.pl</span>
          <span style={{ marginLeft: 22, fontSize: 24, fontWeight: 400, color: "#6b7280" }}>
            26 źródeł poleasingowych w jednym miejscu
          </span>
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
