import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Car, 
  CheckCircle2, 
  ArrowRight,
  Sparkles 
} from 'lucide-react';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Profile data
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');

  // Vehicle data
  const [vehicleName, setVehicleName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  const handleCompleteProfile = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: companyName,
        phone: phone
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

    toast({
      title: "Welcome to ExotIQ! 🎉",
      description: "Your account is ready. Let's optimize your fleet!",
    });

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="card-premium p-8">
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
                    Tell us about your business
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="Your Rental Company"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCompleteProfile}
                  disabled={!companyName || !phone || loading}
                  className="w-full btn-premium"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
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
                    Start building your fleet
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

                <Button
                  onClick={handleAddVehicle}
                  disabled={!vehicleName || !make || !model || !year || !dailyRate || loading}
                  className="w-full btn-premium"
                >
                  Add Vehicle
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
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
                    <Sparkles className="w-8 h-8 text-accent" />
                    <div>
                      <h3 className="font-semibold mb-2">AI-Powered Features Enabled</h3>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>✓ Price optimization recommendations</li>
                        <li>✓ Real-time analytics & insights</li>
                        <li>✓ Smart booking management</li>
                        <li>✓ Document compliance tracking</li>
                      </ul>
                    </div>
                  </div>
                </Card>

                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full btn-premium"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
