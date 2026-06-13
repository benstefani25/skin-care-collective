import { Nav } from "@/components/Nav";

export default function Loading() {
  return (
    <div className="stack">
      <Nav active="book" />
      <div className="sk-line skeleton" style={{ width: "55%", height: 22 }} />
      <div className="sk-card skeleton" />
      <div className="sk-line skeleton" style={{ width: "45%", height: 20, marginTop: 12 }} />
      <div className="sk-card skeleton" />
      <div className="sk-card skeleton" />
    </div>
  );
}
