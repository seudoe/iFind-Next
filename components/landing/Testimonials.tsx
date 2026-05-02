import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "B.Tech CSE, IIT Delhi",
    company: "Got placed at Google",
    text: "iFind helped me land my dream internship at Google. The AI recommendations were spot-on — it matched me with roles that perfectly fit my React and TypeScript skills.",
    rating: 5,
    avatar: "PS",
  },
  {
    name: "Arjun Mehta",
    role: "MBA, IIM Ahmedabad",
    company: "Interned at McKinsey",
    text: "The platform is incredibly intuitive. I found a consulting internship at McKinsey within a week of signing up. The filter system saved me hours of searching.",
    rating: 5,
    avatar: "AM",
  },
  {
    name: "Sneha Patel",
    role: "B.Des, NID Ahmedabad",
    company: "Interned at Swiggy",
    text: "As a design student, I was worried about finding relevant opportunities. iFind had a great selection of UI/UX roles and the application process was seamless.",
    rating: 5,
    avatar: "SP",
  },
];

export function Testimonials() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Students Love iFind
          </h2>
          <p className="text-gray-500 mt-2">
            Join 2 million+ students who found their internships here
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, role, company, text, rating, avatar }) => (
            <div
              key={name}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-gray-600 leading-relaxed mb-5">&ldquo;{text}&rdquo;</p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{name}</p>
                  <p className="text-xs text-gray-500">{role}</p>
                  <p className="text-xs text-blue-600 font-medium">{company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
