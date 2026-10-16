import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

// Muestrario de componentes para trabajar estilos. Solo existe en desarrollo (404 en producción).
export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Showcase />;
}
