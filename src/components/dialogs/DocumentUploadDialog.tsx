import { useState, useRef } from 'react';
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
import { Upload, FileText, Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentTypes = [
    'Insurance',
    'Registration',
    'License',
    'Inspection',
    'Contract',
    'Other'
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to upload documents');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload document');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('customer-documents')
        .getPublicUrl(fileName);

      setUploadedFile({
        url: urlData.publicUrl,
        name: file.name,
        size: file.size
      });
      
      // Auto-fill name if empty
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
      
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Document upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !type || !expiryDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!uploadedFile) {
      toast.error('Please upload a document file');
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
      file_url: uploadedFile.url,
      file_size: uploadedFile.size,
      user_id: '' // Will be set by context
    });

    // Reset form
    setName('');
    setType('');
    setExpiryDate('');
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            Add a new document to your compliance vault. Files are stored securely with SOC2 compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Document File *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="hidden"
              id="doc-file-upload"
            />
            
            {uploadedFile ? (
              <div className="border rounded-lg p-4 flex items-center gap-3 bg-muted/50">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(uploadedFile.size)} • Uploaded successfully
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUploadedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <label
                htmlFor="doc-file-upload"
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer block"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 text-primary mx-auto mb-2 animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                )}
                <p className="text-sm text-muted-foreground">
                  {isUploading ? "Uploading..." : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, JPG up to 10MB
                </p>
              </label>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">Document Name *</Label>
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
            <Label htmlFor="doc-type">Document Type *</Label>
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
            <Label htmlFor="expiry-date">Expiration Date *</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name || !type || !expiryDate || !uploadedFile || isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};