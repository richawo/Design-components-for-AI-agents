import Link from "next/link";
import { RootDocument } from "@/components/site/root-document";
export const metadata = { title: "Page not found | Design for AI", robots: { index: false, follow: true } };
export default function NotFound() { return <RootDocument><main className="mx-auto max-w-3xl px-6 py-24"><p className="font-mono text-sm text-site-fg-3">404</p><h1 className="mt-5 text-5xl font-semibold tracking-tight">Page not found.</h1><Link href="/components" className="site-btn site-btn-secondary mt-8 px-5 py-3">Browse components</Link></main></RootDocument>; }
