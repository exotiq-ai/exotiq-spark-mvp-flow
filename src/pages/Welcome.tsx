import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, ArrowRight, Calendar, Loader2, Sparkles } from 'lucide-react';
import { SEOHead } from '@/components/common/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Celebration } from '@/components/common/MicroInteractions';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Link } from 'react-router-dom';

const Welcome = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendlyLoaded, setIsCalendlyLoaded] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const isPaymentSuccess = searchParams.get('subscription') === 'success' || !!searchParams.get('session_id');

  const [formData, setFormData] = useState({
    businessName: '',
    location: '',
    fleetSize: '',
    vehicleTypes: '',
    currentSoftware: '',
    painPoints: '',
    referralSource: '',
    phone: '',
  });

  // Trigger celebration on payment success
  useEffect(() => {
    if (isPaymentSuccess) {
      setShowCelebration(true);
    }
  }, []);

  // Load Calendly script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setIsCalendlyLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get session ID from URL
      const sessionId = searchParams.get('session_id');

      // Store onboarding response
      const { error } = await supabase.from('onboarding_responses').insert({
        session_id: sessionId,
        business_name: formData.businessName,
        location: formData.location,
        fleet_size: formData.fleetSize,
        vehicle_types: formData.vehicleTypes,
        current_software: formData.currentSoftware,
        pain_points: formData.painPoints,
        referral_source: formData.referralSource,
        phone: formData.phone,
      });

      if (error) throw error;

      toast({
        title: 'Information saved!',
        description: 'Thank you for completing your profile. Book your onboarding session below.',
      });
    } catch (error: any) {
      console.error('Error saving onboarding data:', error);
      toast({
        title: 'Could not save',
        description: 'Your information could not be saved, but you can still book your onboarding.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Welcome to Exotiq - Founding Member"
        description="Complete your onboarding and schedule your setup session"
        url="/welcome"
      />

      <div className="container mx-auto py-12 px-4 max-w-4xl">
        {/* Celebration confetti */}
        <Celebration 
          trigger={showCelebration} 
          message="Welcome to Exotiq! 🎉" 
          variant="milestone"
          onComplete={() => setShowCelebration(false)}
        />

        {/* Success Header */}
        <div className="text-center mb-12">
          {isPaymentSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Badge className="mb-4 bg-success/20 text-success border-success/30 px-4 py-1.5 text-sm">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Payment Confirmed
              </Badge>
            </motion.div>
          )}
          <motion.div
            initial={isPaymentSuccess ? { scale: 0 } : false}
            animate={isPaymentSuccess ? { scale: [0, 1.2, 1] } : {}}
            transition={{ duration: 0.6, times: [0, 0.6, 1] }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6"
          >
            <CheckCircle2 className="h-10 w-10 text-success" />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4">Welcome to Exotiq, Founding Member!</h1>
          <p className="text-xl text-muted-foreground">
            Your founder pricing is locked in forever. Let us get you started.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Onboarding Form */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Tell Us About Your Fleet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Help us prepare for your onboarding session so we can make it as valuable as possible.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  placeholder="Your company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Primary Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="City, State"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fleetSize">Current Fleet Size</Label>
                <Select
                  value={formData.fleetSize}
                  onValueChange={(value) => handleInputChange('fleetSize', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fleet size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-5">1-5 vehicles</SelectItem>
                    <SelectItem value="6-10">6-10 vehicles</SelectItem>
                    <SelectItem value="11-20">11-20 vehicles</SelectItem>
                    <SelectItem value="21-50">21-50 vehicles</SelectItem>
                    <SelectItem value="51-100">51-100 vehicles</SelectItem>
                    <SelectItem value="100+">100+ vehicles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleTypes">Primary Vehicle Types</Label>
                <Input
                  id="vehicleTypes"
                  value={formData.vehicleTypes}
                  onChange={(e) => handleInputChange('vehicleTypes', e.target.value)}
                  placeholder="e.g., Lamborghini, Ferrari, Rolls-Royce"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentSoftware">Current Software/Tools</Label>
                <Input
                  id="currentSoftware"
                  value={formData.currentSoftware}
                  onChange={(e) => handleInputChange('currentSoftware', e.target.value)}
                  placeholder="e.g., Spreadsheets, Rent Centric, Custom"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="painPoints">Biggest Operational Challenge</Label>
                <Textarea
                  id="painPoints"
                  value={formData.painPoints}
                  onChange={(e) => handleInputChange('painPoints', e.target.value)}
                  placeholder="What is your biggest pain point in managing your fleet?"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralSource">How did you hear about Exotiq?</Label>
                <Select
                  value={formData.referralSource}
                  onValueChange={(value) => handleInputChange('referralSource', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Search</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="referral">Friend/Colleague</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="event">Industry Event</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Information
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Calendly Embed */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">Schedule Your Onboarding</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Book a 30-minute session with our team to get your fleet set up and running.
              </p>

              <div className="min-h-[500px] rounded-lg overflow-hidden border border-border">
                {isCalendlyLoaded ? (
                  <div
                    className="calendly-inline-widget w-full h-[500px]"
                    data-url="https://calendly.com/hello-exotiq/30min?hide_gdpr_banner=1"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[500px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>

            {/* Next Steps */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">What Happens Next</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Complete your profile above</p>
                    <p className="text-sm text-muted-foreground">
                      This helps us prepare for your onboarding
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Book your onboarding session</p>
                    <p className="text-sm text-muted-foreground">
                      30 minutes to get your fleet fully set up
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Check your email</p>
                    <p className="text-sm text-muted-foreground">
                      We will send your login credentials and getting started guide
                    </p>
                  </div>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* Skip to Dashboard */}
        <div className="text-center mt-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            Skip for now, take me to the dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
