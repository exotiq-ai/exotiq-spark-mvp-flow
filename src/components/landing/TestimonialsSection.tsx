import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { testimonials } from "./LandingData";

export const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Trusted by Industry Leaders</h2>
          <p className="text-lg sm:text-xl text-muted-foreground px-4">See what our customers are saying</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="card-premium p-6 sm:p-8">
              <div className="flex mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-accent fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base leading-relaxed">"{testimonial.content}"</p>
              <div>
                <div className="font-semibold text-sm sm:text-base">{testimonial.name}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {testimonial.role} at {testimonial.company}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};