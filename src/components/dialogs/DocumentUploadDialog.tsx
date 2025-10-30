import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Upload, FileText, Calendar } from 'lucide-react';
import { TablesInsert } from '@/integrations/supabase/types';

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (document: TablesInsert<"documents">) => Promise<void>;
}

export const DocumentUploadDialog = ({
  open,
  onOpenChange,
  onSubmit
}: DocumentUploadDialogProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const documentTypes = [
    'Insurance',
    'Registration',
    'License',
    'Inspection',
    'Contract',
    'Other'
  ];

  const handleSubmit = async () => {
    if (!name || !type || !expiryDate) {
      return;
    }

    const expiryDateObj = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    await onSubmit({
      name,
      type,
      expires_at: expiryDateObj.toISOString(),
      status: daysUntilExpiry <= 30 ? 'expiring' : 'active',
      file_url: 'https://placeholder.com/document', // Placeholder for now
      user_id: '' // Will be set by context
    });

    // Reset form
    setName('');
    setType('');
    setExpiryDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-primary" />
            <span>Upload Document</span>
          </DialogTitle>
          <DialogDescription>
            Add a new document to your compliance vault
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">Document Name</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="doc-name"
                placeholder="McLaren 720S Insurance Policy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Document Type */}
          <div className="space-y-2">
            <Label htmlFor="doc-type">Document Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="doc-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label htmlFor="expiry-date">Expiration Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* File Upload (Simulated) */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">File</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOC, JPG up to 10MB
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !type || !expiryDate}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
