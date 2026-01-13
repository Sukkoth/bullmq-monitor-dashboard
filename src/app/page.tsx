import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Navbar */}
      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="container-width py-4 flex items-center justify-between">
          <div className="font-bold text-xl flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full" />
            BullMonitor
          </div>
          <div className="flex gap-6 text-sm font-medium text-muted-foreground">
            <Link
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#integration"
              className="hover:text-foreground transition-colors"
            >
              Integration
            </Link>
            <Link
              href="#faq"
              className="hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-32 border-b border-border bg-muted/30">
        <div className="container-width text-center">
          <Badge
            variant="secondary"
            className="mb-8 gap-2 py-1.5 px-4 text-sm font-medium rounded-full"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            v1.0 Now Available
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-foreground">
            The Ultimate <span className="text-primary">Dashboard</span>
            <br /> for BullMQ.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Visualize, inspect, and manage your background jobs with ease. A
            powerful monitoring tool designed for developers who need full
            visibility into their Redis queues.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg">View Dashboard</Button>
            <Button variant="outline" size="lg">
              Read the Docs
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-b border-border">
        <div className="container-width">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Open Source
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-1">0ms</div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Lag
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-1">
                Redis
              </div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Native
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-1">TS</div>
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Type Safe
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/20">
        <div className="container-width">
          <div className="mb-16 text-center md:text-left">
            <h2 className="text-3xl font-bold mb-4">Monitoring Capabilities</h2>
            <p className="text-muted-foreground max-w-xl">
              Gain deep insights into your job queues. Track status, inspect
              payloads, and manage job lifecycles directly from the UI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              title="Live Monitoring"
              description="Watch your jobs process in real-time. See active, waiting, completed, and failed counts update instantly via WebSockets."
            />
            <FeatureCard
              title="Job Inspection"
              description="Deep dive into job details. View data payloads, return values, stacktraces, and progress logs with syntax highlighting."
            />
            <FeatureCard
              title="Retry Management"
              description="Manually retry failed jobs or bulk-retry multiple jobs at once to recover from errors without touching the CLI."
            />
            <FeatureCard
              title="Queue Control"
              description="Pause and resume queues globally. Clean old jobs and manage queue concurrency settings on the fly."
            />
            <FeatureCard
              title="Delayed Jobs"
              description="Inspect upcoming scheduled jobs. See when they are due to run and promote them to active status if needed."
            />
            <FeatureCard
              title="Redis Insights"
              description="View underlying Redis memory usage, fragmentation ratio, and connection status for your queue infrastructure."
            />
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section id="integration" className="py-24 border-t border-border">
        <div className="container-width">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Connect in Seconds</h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Get up and running immediately. Simply connect your Redis
                instance and BullMonitor will automatically discover and
                visualize all your queues. No code changes required.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">
                    ✓
                  </div>
                  <span className="text-foreground font-medium">
                    Works with any Redis instance
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">
                    ✓
                  </div>
                  <span className="text-foreground font-medium">
                    Auto-discovery of queues
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">
                    ✓
                  </div>
                  <span className="text-foreground font-medium">
                    Secure & Read-only modes
                  </span>
                </li>
              </ul>
              <Button variant="outline">View Connection Guide</Button>
            </div>

            {/* Connection UI Mockup */}
            <Card className="w-full max-w-md mx-auto shadow-lg">
              <CardHeader className="border-b border-border bg-muted/30 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    New Connection
                  </CardTitle>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/20 border border-red-400/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/20 border border-yellow-400/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/20 border border-green-400/50" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Connection Name
                  </Label>
                  <Input
                    defaultValue="Production Queues"
                    className="bg-background"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Redis Host
                    </Label>
                    <Input
                      defaultValue="redis-cache.internal"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Port
                    </Label>
                    <Input defaultValue="6379" className="bg-background" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </Label>
                  <Input
                    type="password"
                    value="••••••••••••••••••••••••"
                    readOnly
                    className="bg-background text-muted-foreground"
                  />
                </div>

                <div className="pt-4">
                  <Button className="w-full">Connect Dashboard</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-muted/20">
        <div className="container-width max-w-4xl">
          <h2 className="text-3xl font-bold mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="Does it work with Bull and BullMQ?"
              answer="Yes! We support both the legacy Bull library and the newer BullMQ. You can even mix and match them in the same dashboard."
            />
            <FaqItem
              question="Can I protect the dashboard with a password?"
              answer="Absolutely. Since the monitor is mounted as standard middleware, you can use any authentication middleware (like Passport, Basic Auth, or custom logic) to protect the route."
            />
            <FaqItem
              question="Does it support Redis Cluster?"
              answer="Yes, we fully support Redis Cluster and Sentinel configurations. Just pass your Redis connection options when initializing the queues."
            />
            <FaqItem
              question="Is there a performance impact?"
              answer="The monitor is designed to be extremely lightweight. It only queries Redis when you actively view the dashboard, so there is zero overhead on your job processing workers."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-border">
        <div className="container-width text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to take control?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Join thousands of developers who trust BullMonitor to keep their
            background jobs running smoothly.
          </p>
          <Button size="lg" className="text-lg px-8 py-6">
            Get Started for Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-muted/30">
        <div className="container-width">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-sm text-muted-foreground">
              © 2024 BullMonitor. Open source under MIT License.
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a
                href="https://github.com/taskforcesh/bullmq"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://bullmq.io"
                className="hover:text-foreground transition-colors"
              >
                Documentation
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed text-sm">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle className="text-lg">{question}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground leading-relaxed">{answer}</p>
      </CardContent>
    </Card>
  );
}
