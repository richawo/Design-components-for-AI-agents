import { RootDocument, rootMetadata, rootViewport } from "@/components/site/root-document";
import { SiteShell } from "@/components/site/site-shell";
export const metadata = rootMetadata;
export const viewport = rootViewport;
export default function Layout({ children }: { children: React.ReactNode }) { return <RootDocument><SiteShell>{children}</SiteShell></RootDocument>; }
