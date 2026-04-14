import Link from "next/link";
import Image from "next/image";

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "AI Insights", href: "#ai" },
    { label: "Live Demo", href: "/demo" },
  ],
  resources: [
    { label: "Security", href: "#security" },
    { label: "FAQ", href: "#faq" },
    { label: "Sign Up", href: "/signup" },
    { label: "Log In", href: "/login" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-up">
        {/* Top section */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Link href="/" className="group flex items-center gap-2 text-lg font-bold">
              <Image
                src="/minimal_optimized_for_favicon.png"
                alt="ExpenseVision logo"
                width={50}
                height={50}
                className="transition-transform duration-300 group-hover:scale-110"
              />
              <span>ExpenseVision</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              AI-powered expense tracking, budgeting, and insights. Built with Next.js, Supabase, and modern web technologies.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product</h3>
            <ul className="mt-3 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resources</h3>
            <ul className="mt-3 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ExpenseVision. Built with Next.js &amp; Supabase.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>A portfolio project by</span>
            <span className="font-medium text-foreground">Yogesh Vadivel</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
