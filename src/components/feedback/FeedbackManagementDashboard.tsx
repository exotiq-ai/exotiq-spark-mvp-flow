import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  MessageSquare, 
  Lightbulb, 
  Bug, 
  Zap, 
  HelpCircle, 
  FileText, 
  ThumbsUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Filter,
  Search,
  ChevronRight,
  User,
  Calendar,
  Target,
  Edit,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Feedback {
  id: string;
  user_id: string;
  category: string;
  priority: string;
  status: string;
  user_query: string;
  context: any;
  keywords: string[];
  upvotes: number;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  assigned_to: string | null;
  estimated_effort: string | null;
  target_version: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

const categoryIcons: Record<string, any> = {
  feature_request: Lightbulb,
  bug_report: Bug,
  improvement: Zap,
  question: HelpCircle,
  other: FileText,
};

const priorityColors: Record<string, string> = {
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  under_review: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  planned: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  declined: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function FeedbackManagementDashboard() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Edit form state
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editEstimatedEffort, setEditEstimatedEffort] = useState("");
  const [editTargetVersion, setEditTargetVersion] = useState("");

  useEffect(() => {
    loadFeedback();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('feedback_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rari_feedback' },
        () => {
          loadFeedback();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [feedbackList, searchQuery, filterCategory, filterPriority, filterStatus, activeTab]);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rari_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbackList(data || []);
    } catch (error: any) {
      console.error("Error loading feedback:", error);
      toast({
        title: "Error loading feedback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...feedbackList];

    // Apply tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter(f => f.status === activeTab);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.user_query.toLowerCase().includes(query) ||
        f.keywords?.some(k => k.includes(query))
      );
    }

    // Apply category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter(f => f.category === filterCategory);
    }

    // Apply priority filter
    if (filterPriority !== "all") {
      filtered = filtered.filter(f => f.priority === filterPriority);
    }

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(f => f.status === filterStatus);
    }

    setFilteredFeedback(filtered);
  };

  const openEditDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setEditStatus(feedback.status || "new");
    setEditPriority(feedback.priority || "medium");
    setEditAdminNotes(feedback.admin_notes || "");
    setEditAssignedTo(feedback.assigned_to || "");
    setEditEstimatedEffort(feedback.estimated_effort || "");
    setEditTargetVersion(feedback.target_version || "");
    setIsEditDialogOpen(true);
  };

  const updateFeedback = async () => {
    if (!selectedFeedback) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("rari_feedback")
        .update({
          status: editStatus,
          priority: editPriority,
          admin_notes: editAdminNotes,
          assigned_to: editAssignedTo,
          estimated_effort: editEstimatedEffort,
          target_version: editTargetVersion,
          resolved: editStatus === "completed",
          resolved_at: editStatus === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", selectedFeedback.id);

      if (error) throw error;

      toast({
        title: "Feedback updated",
        description: "The feedback has been successfully updated.",
      });

      setIsEditDialogOpen(false);
      loadFeedback();
    } catch (error: any) {
      console.error("Error updating feedback:", error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStats = () => {
    return {
      total: feedbackList.length,
      new: feedbackList.filter(f => f.status === "new").length,
      under_review: feedbackList.filter(f => f.status === "under_review").length,
      planned: feedbackList.filter(f => f.status === "planned").length,
      in_progress: feedbackList.filter(f => f.status === "in_progress").length,
      completed: feedbackList.filter(f => f.status === "completed").length,
      critical: feedbackList.filter(f => f.priority === "critical").length,
      high: feedbackList.filter(f => f.priority === "high").length,
    };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-dark border-gold/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-dark border-gold/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">New Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.new}</div>
          </CardContent>
        </Card>
        <Card className="bg-dark border-gold/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{stats.in_progress}</div>
          </CardContent>
        </Card>
        <Card className="bg-dark border-gold/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Critical/High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{stats.critical + stats.high}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-dark border-gold/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Feedback Management</CardTitle>
              <CardDescription className="text-gray-400">
                View and manage user feedback and feature requests
              </CardDescription>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black border-gold/20 text-white"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] bg-black border-gold/20 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-dark border-gold/20">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug_report">Bug Report</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px] bg-black border-gold/20 text-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-dark border-gold/20">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-black border-gold/20">
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="new">New ({stats.new})</TabsTrigger>
              <TabsTrigger value="under_review">Review ({stats.under_review})</TabsTrigger>
              <TabsTrigger value="planned">Planned ({stats.planned})</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress ({stats.in_progress})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gold" />
                </div>
              ) : filteredFeedback.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No feedback found</p>
                </div>
              ) : (
                filteredFeedback.map((feedback) => {
                  const CategoryIcon = categoryIcons[feedback.category] || FileText;
                  return (
                    <Card
                      key={feedback.id}
                      className="bg-black border-gold/10 hover:border-gold/30 transition-colors cursor-pointer"
                      onClick={() => openEditDialog(feedback)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 bg-gold/10 rounded-lg">
                            <CategoryIcon className="w-5 h-5 text-gold" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-white font-medium line-clamp-2">
                                  {feedback.user_query}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge className={priorityColors[feedback.priority]}>
                                    {feedback.priority}
                                  </Badge>
                                  <Badge className={statusColors[feedback.status]}>
                                    {feedback.status.replace('_', ' ')}
                                  </Badge>
                                  <Badge variant="outline" className="border-gold/20 text-gray-400">
                                    {feedback.category.replace('_', ' ')}
                                  </Badge>
                                  {feedback.upvotes > 0 && (
                                    <Badge variant="outline" className="border-gold/20 text-gray-400">
                                      <ThumbsUp className="w-3 h-3 mr-1" />
                                      {feedback.upvotes}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                              </span>
                              {feedback.assigned_to && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Assigned
                                </span>
                              )}
                              {feedback.target_version && (
                                <span className="flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  v{feedback.target_version}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] bg-black border-gold/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-gold" />
              Manage Feedback
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the status, priority, and other details of this feedback item.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6 py-4">
              {/* Original Feedback */}
              <div className="space-y-2">
                <Label className="text-white">User Feedback</Label>
                <div className="bg-dark border border-gold/10 rounded-lg p-4">
                  <p className="text-white text-sm whitespace-pre-wrap">{selectedFeedback.user_query}</p>
                  {selectedFeedback.keywords && selectedFeedback.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {selectedFeedback.keywords.slice(0, 5).map((keyword, idx) => (
                        <Badge key={idx} variant="outline" className="border-gold/20 text-gray-400 text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="bg-dark border-gold/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-dark border-gold/20">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger className="bg-dark border-gold/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-dark border-gold/20">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assignment and Effort */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Assigned To</Label>
                  <Input
                    placeholder="Team member name"
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="bg-dark border-gold/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Estimated Effort</Label>
                  <Select value={editEstimatedEffort} onValueChange={setEditEstimatedEffort}>
                    <SelectTrigger className="bg-dark border-gold/20 text-white">
                      <SelectValue placeholder="Select effort" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark border-gold/20">
                      <SelectItem value="small">Small (1-2 days)</SelectItem>
                      <SelectItem value="medium">Medium (3-5 days)</SelectItem>
                      <SelectItem value="large">Large (1-2 weeks)</SelectItem>
                      <SelectItem value="xlarge">X-Large (2+ weeks)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Target Version */}
              <div className="space-y-2">
                <Label className="text-white">Target Version</Label>
                <Input
                  placeholder="e.g., 2.1.0"
                  value={editTargetVersion}
                  onChange={(e) => setEditTargetVersion(e.target.value)}
                  className="bg-dark border-gold/20 text-white"
                />
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label className="text-white">Admin Notes (Internal)</Label>
                <Textarea
                  placeholder="Add internal notes about this feedback..."
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  className="min-h-[100px] bg-dark border-gold/20 text-white"
                />
              </div>

              {/* Context (Read-only) */}
              {selectedFeedback.context && Object.keys(selectedFeedback.context).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-white text-xs">Additional Context</Label>
                  <div className="bg-dark border border-gold/10 rounded-lg p-3">
                    <pre className="text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(selectedFeedback.context, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gold/10">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isUpdating}
                  className="border-gold/20 text-white hover:bg-gold/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={updateFeedback}
                  disabled={isUpdating}
                  className="bg-gold hover:bg-gold/90 text-black"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
