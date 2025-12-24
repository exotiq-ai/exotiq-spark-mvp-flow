import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";
import { testimonials } from "./LandingData";

export const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-24 lg:py-32 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4">Customer Stories</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Loved by fleet operators
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            See why leading exotic car rental businesses choose Exotiq
          </p>
        </div>
        
        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="group p-8 rounded-2xl bg-card/50 border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              {/* Quote icon */}
              <Quote className="h-8 w-8 text-primary/20 mb-4 group-hover:text-primary/40 transition-colors" />
              
              {/* Content */}
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              {/* Rating */}
              <div className="flex mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-amber-400 fill-current" />
                ))}
              </div>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-sm">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
