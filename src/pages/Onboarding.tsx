import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { 
  Building2, 
  Car, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  Loader2
} from 'lucide-react';

interface OnboardingFormData {
  companyName: string;
  phone: string;
  location: string;
  fleetSize: string;
  businessType: string;
}

const initialFormData: OnboardingFormData = {
  companyName: '',
  phone: '',
  location: '',
  fleetSize: '',
  businessType: '',
};

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Progress persistence using localStorage
  const storageKey = user?.id ? `onboarding-${user.id}` : 'onboarding-temp';
  const [savedStep, setSavedStep] = useLocalStorage<number>(`${storageKey}-step`, 1);
  const [savedFormData, setSavedFormData] = useLocalStorage<OnboardingFormData>(`${storageKey}-data`, initialFormData);
  
  const [step, setStep] = useState(savedStep);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormData>(savedFormData);

  // Vehicle data (not persisted - optional step)
  const [vehicleName, setVehicleName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  // Sync step and form data to localStorage
  useEffect(() => {
    setSavedStep(step);
  }, [step, setSavedStep]);

  useEffect(() => {
    setSavedFormData(formData);
  }, [formData, setSavedFormData]);

  const updateFormData = (field: keyof OnboardingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompleteProfile = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: formData.companyName,
        phone: formData.phone,
        location: formData.location,
        fleet_size: formData.fleetSize,
        business_type: formData.businessType,
      })
      .eq('id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    setStep(2);
    setLoading(false);
  };

  const handleAddVehicle = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('vehicles')
      .insert({
        user_id: user.id,
        name: vehicleName,
        make: make,
        model: model,
        year: parseInt(year),
        current_rate: parseFloat(dailyRate),
        status: 'available'
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    setStep(3);
    setLoading(false);
  };

  const handleSkipVehicle = () => {
    setStep(3);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/auth');
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // Clear localStorage after completion
    localStorage.removeItem(`${storageKey}-step`);
    localStorage.removeItem(`${storageKey}-data`);

    toast({
      title: "Welcome to Exotiq! 🎉",
      description: "Your account is ready. Let's optimize your fleet!",
    });

    navigate('/dashboard');
  };

  const isStep1Valid = formData.companyName.trim() !== '' && formData.phone.trim() !== '';
  const isStep2Valid = vehicleName && make && model && year && dailyRate;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="card-premium p-6 sm:p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-2 rounded-full mx-1 transition-all ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Step {step} of 3
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Company Profile</h2>
                  <p className="text-muted-foreground">
                    Tell us about your business to personalize your experience
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      placeholder="Your Rental Company"
                      value={formData.companyName}
                      onChange={(e) => updateFormData('companyName', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => updateFormData('phone', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Primary Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="location"
                        className="pl-10"
                        placeholder="City, State (e.g., Miami, FL)"
                        value={formData.location}
                        onChange={(e) => updateFormData('location', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fleetSize">Fleet Size</Label>
                      <Select
                        value={formData.fleetSize}
                        onValueChange={(value) => updateFormData('fleetSize', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-5">1-5 vehicles</SelectItem>
                          <SelectItem value="6-10">6-10 vehicles</SelectItem>
                          <SelectItem value="11-20">11-20 vehicles</SelectItem>
                          <SelectItem value="21-50">21-50 vehicles</SelectItem>
                          <SelectItem value="50+">50+ vehicles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type</Label>
                      <Select
                        value={formData.businessType}
                        onValueChange={(value) => updateFormData('businessType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exotic">Exotic & Supercar</SelectItem>
                          <SelectItem value="luxury">Luxury & Premium</SelectItem>
                          <SelectItem value="classic">Classic & Vintage</SelectItem>
                          <SelectItem value="mixed">Mixed Fleet</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleCompleteProfile}
                    disabled={!isStep1Valid || loading}
                    className="w-full btn-premium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <Car className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Add Your First Vehicle</h2>
                  <p className="text-muted-foreground">
                    Start building your fleet (you can always add more later)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleName">Vehicle Name</Label>
                    <Input
                      id="vehicleName"
                      placeholder="McLaren 720S"
                      value={vehicleName}
                      onChange={(e) => setVehicleName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="make">Make</Label>
                      <Input
                        id="make"
                        placeholder="McLaren"
                        value={make}
                        onChange={(e) => setMake(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        placeholder="720S"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        placeholder="2024"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dailyRate">Daily Rate ($)</Label>
                      <Input
                        id="dailyRate"
                        type="number"
                        placeholder="450"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleAddVehicle}
                    disabled={!isStep2Valid || loading}
                    className="w-full btn-premium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        Add Vehicle
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={handleSkipVehicle}
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    Skip for now — I'll add vehicles later
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
                  <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your account is ready. Let's start optimizing your fleet!
                  </p>
                </div>

                <Card className="bg-gradient-to-br from-accent/10 to-primary/5 border-accent/20 p-6">
                  <div className="flex items-start space-x-4">
                    <Sparkles className="w-8 h-8 text-accent flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-3">Key Features You'll Love</h3>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">MotorIQ</span> - AI-powered pricing optimization
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">Pulse</span> - Real-time analytics & insights
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">Book</span> - Smart booking management
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">Vault</span> - Document compliance tracking
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">Rari AI</span> - Your voice-powered assistant
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>

                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <p className="text-sm text-muted-foreground text-center">
                    💡 <span className="font-medium">Pro tip:</span> When you reach the dashboard, we'll show you a quick tour of the key features. You can skip it anytime!
                  </p>
                </div>

                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full btn-premium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finishing...
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
