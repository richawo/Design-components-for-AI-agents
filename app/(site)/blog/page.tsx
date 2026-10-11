import BlogIndex from "@/components/site/blog-index";
import { hubMetadata } from "@/lib/blog/seo";
export const generateMetadata = () => hubMetadata();
export default function Page() { return <BlogIndex />; }
