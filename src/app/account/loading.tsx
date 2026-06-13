import { Nav } from "@/components/Nav";

export default function Loading() {
  return (
    <div className="stack">
      <Nav active="account" />
      <div className="sk-card skeleton" style={{ height: 220 }} />
      <div className="sk-card skeleton" style={{ height: 120 }} />
    </div>
  );
}
