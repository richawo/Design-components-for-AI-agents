import "./preview.css";
import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";
export const metadata = rootMetadata;
export const viewport = rootViewport;
export default function Layout({ children }: { children: React.ReactNode }) { return <RootDocument>{children}</RootDocument>; }
