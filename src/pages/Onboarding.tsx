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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useOnboardingProgress, OnboardingFormData } from '@/hooks/useOnboardingProgress';
import { AddressAutocomplete, AddressData } from '@/components/ui/address-autocomplete';
import { LocationInput, LocationData } from '@/components/onboarding/LocationInput';
import { 
  Building2, 
  Car, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Camera,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTeam } from '@/contexts/TeamContext';
import { useFleet } from '@/contexts/FleetContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ImportWizard } from '@/components/import/ImportWizard';
import { Badge } from '@/components/ui/badge';
import { AddVehicleFromPhotoWizard } from '@/components/photos/AddVehicleFromPhotoWizard';

const initialFormData: OnboardingFormData = {
  companyName: '',
  businessAddress: null,
  website: '',
  phone: '',
  email: '',
  fleetSize: '',
  businessType: '',
  locations: [],
};

export default function Onboarding() {
  const { user } = useAuth();
  const { currentTeam, refreshTeam } = useTeam();
  const { refreshData } = useFleet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const isEditMode = searchParams.get('edit') === 'true';
  
  // Database-backed progress with localStorage fallback
  const {
    currentStep: dbCurrentStep,
    formData: dbFormData,
    isLoading: progressLoading,
    isSaving,
    isOffline,
    hasPendingSync,
    updateFormDataDebounced,
    goToStep,
    completeStep,
    markComplete,
  } = useOnboardingProgress();
  
  // Local state for immediate UI response
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);

  // Vehicle data (not persisted - optional step)
  const [vehicleName, setVehicleName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [dailyRate, setDailyRate] = useState('');

  // Step 3 mode: 'choice' | 'manual'
  const [step3Mode, setStep3Mode] = useState<'choice' | 'manual'>('choice');
  const [showPhotoWizard, setShowPhotoWizard] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Sync from database on load (non-edit mode only)
  useEffect(() => {
    if (!progressLoading && !isEditMode) {
      setStep(dbCurrentStep);
      if (dbFormData && Object.keys(dbFormData).length > 0) {
        setFormData(prev => ({
          ...prev,
          ...dbFormData,
          // Ensure email is set from user if not in dbFormData
          email: dbFormData.email || user?.email || prev.email,
        }));
      }
    }
  }, [progressLoading, dbCurrentStep, dbFormData, isEditMode, user?.email]);

  // Set email from auth for new users
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user?.email, formData.email]);

  // Load existing data in edit mode
  useEffect(() => {
    const loadExistingData = async () => {
      if (!isEditMode || !user?.id) {
        setInitialLoading(false);
        return;
      }

      try {
        // Fetch profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_name, phone, website, business_address, fleet_size, business_type')
          .eq('id', user.id)
          .single();

        // Fetch locations
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, address, city, state, zip_code, country, is_default')
          .eq('team_id', currentTeam?.id);

        if (profile) {
          // Safely cast the JSON business_address
          const businessAddress = profile.business_address as unknown as AddressData | null;
          
          setFormData({
            companyName: profile.company_name || '',
            businessAddress: businessAddress,
            website: profile.website || '',
            phone: profile.phone || '',
            email: user.email || '',
            fleetSize: profile.fleet_size || '',
            businessType: profile.business_type || '',
            locations: locations?.map(loc => ({
              id: loc.id,
              name: loc.name,
              address: {
                street: loc.address || '',
                city: loc.city || '',
                state: loc.state || '',
                zip: loc.zip_code || '',
                country: loc.country || '',
                formatted: [loc.address, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', '),
              },
              isPrimary: loc.is_default || false,
            })) || [],
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadExistingData();
  }, [isEditMode, user?.id, currentTeam?.id, user?.email]);

  // Step change handler that persists to database
  const handleStepChange = async (newStep: number, markPreviousComplete = true) => {
    setStep(newStep); // Immediate UI update

    if (!isEditMode) {
      await goToStep(newStep);
      if (markPreviousComplete && newStep > 1) {
        await completeStep(newStep - 1);
      }
    }
  };

  const updateFormData = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // Auto-save to database (debounced) - fallback handled in hook
    if (!isEditMode) {
      updateFormDataDebounced({ [field]: value });
    }
  };

  const handleSaveStep1 = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Cast AddressData to Json-compatible format
      const businessAddressJson = formData.businessAddress ? {
        ...formData.businessAddress
      } : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: formData.companyName,
          phone: formData.phone,
          website: formData.website,
          business_address: businessAddressJson as any,
        })
        .eq('id', user.id);

      if (error) throw error;

      await handleStepChange(2);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep2 = async () => {
    if (!user || !currentTeam?.id) return;
    setLoading(true);

    try {
      // Update profile with fleet info
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          fleet_size: formData.fleetSize,
          business_type: formData.businessType,
          number_of_locations: formData.locations.length,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Handle locations - first get existing
      const { data: existingLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('team_id', currentTeam.id);

      const existingIds = existingLocations?.map(l => l.id) || [];
      const newLocationIds = formData.locations.map(l => l.id);
      
      // Delete removed locations
      const toDelete = existingIds.filter(id => !newLocationIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('locations').delete().in('id', toDelete);
      }

      // Upsert locations
      for (const loc of formData.locations) {
        const locationData = {
          id: loc.id,
          team_id: currentTeam.id,
          name: loc.name,
          address: loc.address.street,
          city: loc.address.city,
          state: loc.address.state,
          zip_code: loc.address.zip,
          country: loc.address.country,
          is_default: loc.isPrimary,
          is_active: true,
        };

        if (existingIds.includes(loc.id)) {
          await supabase.from('locations').update(locationData).eq('id', loc.id);
        } else {
          await supabase.from('locations').insert(locationData);
        }
      }

      // Reset default flags and set new primary
      await supabase
        .from('locations')
        .update({ is_default: false })
        .eq('team_id', currentTeam.id);
      
      const primaryLocation = formData.locations.find(l => l.isPrimary);
      if (primaryLocation) {
        await supabase
          .from('locations')
          .update({ is_default: true })
          .eq('id', primaryLocation.id);
      }

      await refreshTeam();
      
      if (isEditMode) {
        toast({
          title: "Setup Updated",
          description: "Your business information has been saved.",
        });
        navigate('/dashboard?tab=settings');
      } else {
        await handleStepChange(3);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('vehicles')
        .insert({
          user_id: user.id,
          team_id: currentTeam?.id,
          name: vehicleName,
          make: make,
          model: model,
          year: parseInt(year),
          current_rate: parseFloat(dailyRate),
          status: 'available'
        });

      if (error) throw error;

      // Refresh fleet data to sync state before advancing
      await refreshData();

      await handleStepChange(4);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipVehicle = async () => {
    await handleStepChange(4, false);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (isEditMode) {
      navigate('/dashboard?tab=settings');
    } else {
      navigate('/auth');
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (error) throw error;

      // Mark onboarding progress as complete in database
      await markComplete();
      await completeStep(4);

      // Fire confetti
      const colors = ['#0B3D91', '#FF6B35', '#FFD700'];
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });

      toast({
        title: "Welcome to Exotiq! 🎉",
        description: "Your account is ready. Let's optimize your fleet!",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Validation
  const isStep1Valid = 
    formData.companyName.trim().length >= 2 &&
    formData.businessAddress?.formatted &&
    formData.phone.trim().length >= 7 &&
    (formData.website.trim() === '' || formData.website.match(/^https?:\/\/.+/));
  
  const isStep2Valid = 
    formData.fleetSize !== '' &&
    formData.businessType !== '' &&
    formData.locations.length > 0;

  const isStep3Valid = vehicleName && make && model && year && dailyRate;

  const totalSteps = isEditMode ? 2 : 4;

  // Combined loading state
  if (initialLoading || (progressLoading && !isEditMode)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full mx-1 transition-all ${
                    i + 1 <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Step {step} of {totalSteps}
              {isEditMode && ' — Edit Mode'}
            </p>
          </div>

          {/* Sync Status Indicator */}
          {(isSaving || hasPendingSync) && !isEditMode && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
              {isOffline ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Saved locally — will sync when online
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </>
              ) : null}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Business Profile */}
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
                  <h2 className="text-2xl font-bold mb-2">Business Profile</h2>
                  <p className="text-muted-foreground">
                    Let's set up your company information
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
                    <Label>Business Address *</Label>
                    <AddressAutocomplete
                      value={formData.businessAddress}
                      onChange={(addr) => updateFormData('businessAddress', addr)}
                      placeholder="Search for your business address..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://yourcompany.com"
                        value={formData.website}
                        onChange={(e) => updateFormData('website', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        Phone *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleSaveStep1}
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
                        {isEditMode ? 'Continue' : 'Continue'}
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
                    {isEditMode ? 'Cancel' : 'Back to Sign In'}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Fleet & Locations */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Fleet & Locations</h2>
                  <p className="text-muted-foreground">
                    Tell us about your fleet and where you operate
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fleetSize">Fleet Size *</Label>
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
                      <Label htmlFor="businessType">Business Type *</Label>
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

                  <LocationInput
                    value={formData.locations}
                    onChange={(locations) => updateFormData('locations', locations)}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleSaveStep2}
                    disabled={!isStep2Valid || loading}
                    className="w-full btn-premium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        {isEditMode ? 'Save Changes' : 'Continue'}
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
                    Back
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Add Fleet - Choice or Manual Entry */}
            {step === 3 && !isEditMode && step3Mode === 'choice' && (
              <motion.div
                key="step3-choice"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <Car className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="text-2xl font-bold mb-2">Add Your Fleet</h2>
                  <p className="text-muted-foreground">
                    How would you like to add your vehicles?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bulk Import Option */}
                  <Card 
                    className="p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                    onClick={() => setShowImportDialog(true)}
                  >
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                        <FileSpreadsheet className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">Bulk Import</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload a CSV or Excel file with your fleet data
                      </p>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        Recommended
                      </Badge>
                    </div>
                  </Card>

                  {/* Single Vehicle Option */}
                  <Card 
                    className="p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                    onClick={() => setStep3Mode('manual')}
                  >
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 group-hover:bg-muted/80 transition-colors">
                        <Car className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold mb-2">Add Manually</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Enter vehicle details one at a time
                      </p>
                      <Badge variant="outline" className="opacity-0">
                        Placeholder
                      </Badge>
                    </div>
                  </Card>
                </div>

                {/* Add from Photos - Premium Option */}
                <Card 
                  className="p-5 cursor-pointer hover:border-accent transition-all bg-gradient-to-r from-accent/5 to-primary/5 border-accent/20"
                  onClick={() => setShowPhotoWizard(true)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1 flex items-center gap-2">
                        Add from Photos
                        <Sparkles className="w-4 h-4 text-accent" />
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Upload vehicle photos — AI extracts make, model, and details
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="flex flex-col gap-3 pt-2">
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

            {/* Step 3: Manual Vehicle Entry */}
            {step === 3 && !isEditMode && step3Mode === 'manual' && (
              <motion.div
                key="step3-manual"
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        placeholder="720S"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
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
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleAddVehicle}
                    disabled={!isStep3Valid || loading}
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
                    onClick={() => setStep3Mode('choice')}
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to options
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Completion (skip in edit mode) */}
            {step === 4 && !isEditMode && (
              <motion.div
                key="step4"
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
                            <span className="font-medium">Vault</span> - Compliance & document management
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <div>
                            <span className="font-medium">Rari</span> - Your AI fleet assistant
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>

                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="w-full btn-premium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
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

      {/* Bulk Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Your Fleet</DialogTitle>
            <DialogDescription>
              Upload your vehicle data from a CSV or Excel file
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ImportWizard 
              onClose={() => setShowImportDialog(false)}
              onComplete={async (entityType, count) => {
                setShowImportDialog(false);
                toast({
                  title: "Import Complete! 🎉",
                  description: `Successfully imported ${count} ${entityType}.`,
                });
                // Advance to completion step
                await handleStepChange(4);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Wizard Dialog */}
      <AddVehicleFromPhotoWizard
        open={showPhotoWizard}
        onOpenChange={setShowPhotoWizard}
        onComplete={async (vehicleId) => {
          setShowPhotoWizard(false);
          toast({
            title: "Vehicle Added! 🎉",
            description: "Your vehicle has been created with photos.",
          });
          // Advance to completion step
          await handleStepChange(4);
        }}
      />
    </div>
  );
}
