import { Shield, Lock, Eye, Server } from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "Encrypted in Transit & at Rest",
    description: "All data encrypted via TLS in transit and AES-256 at rest on Supabase's managed infrastructure.",
  },
  {
    icon: Shield,
    title: "Row-Level Security",
    description: "Database policies ensure you can only access your own data.",
  },
  {
    icon: Eye,
    title: "Privacy First",
    description: "We never sell your data. You own it completely. Export anytime.",
  },
  {
    icon: Server,
    title: "Cloud Infrastructure",
    description: "Hosted on Supabase (AWS) with managed backups and scalability.",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-500">
            Security
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your financial data, locked down
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built with security as a first-class concern — TLS encryption,
            row-level isolation, and privacy-first defaults.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {securityFeatures.map((item, index) => (
            <div
              key={item.title}
              className="group rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/5 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${300 + index * 100}ms` }}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 transition-all duration-300 group-hover:bg-green-500/20 group-hover:scale-110">
                <item.icon className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
