import Link from "next/link";
import { Briefcase, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white">iFind</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              India&apos;s smartest internship platform. Connecting students with
              opportunities that match their skills and aspirations.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <SocialLink href="#" icon={<ExternalLink className="h-4 w-4" />} label="Twitter" />
              <SocialLink href="#" icon={<ExternalLink className="h-4 w-4" />} label="LinkedIn" />
              <SocialLink href="#" icon={<ExternalLink className="h-4 w-4" />} label="Instagram" />
              <SocialLink href="#" icon={<ExternalLink className="h-4 w-4" />} label="GitHub" />
            </div>
          </div>

          {/* Links */}
          <FooterSection
            title="For Students"
            links={[
              { label: "Browse Internships", href: "/dashboard?tab=internships" },
              { label: "Resume Builder", href: "/dashboard?tab=resume" },
              { label: "My Applications", href: "/dashboard?tab=overview" },
              { label: "Profile", href: "/dashboard?tab=profile" },
            ]}
          />
          <FooterSection
            title="Company"
            links={[
              { label: "About Us", href: "#" },
              { label: "Blog", href: "#" },
              { label: "Careers", href: "#" },
              { label: "Contact", href: "#" },
            ]}
          />
          <FooterSection
            title="Legal"
            links={[
              { label: "Privacy Policy", href: "#" },
              { label: "Terms of Service", href: "#" },
              { label: "Cookie Policy", href: "#" },
            ]}
          />
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} iFind. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Made with ❤️ for students across India
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="h-8 w-8 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-colors"
    >
      {icon}
    </a>
  );
}

function FooterSection({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
